function _hasSidePanel() {
  return !!(chrome.sidePanel && chrome.sidePanel.setPanelBehavior && chrome.sidePanel.open);
}
function _syncPanelClick(param1) {
  if (!_hasSidePanel()) return;
  chrome.sidePanel
    .setPanelBehavior({
      openPanelOnActionClick: !!param1,
    })
    .catch(() => {});
}
function _openExtensionUi(param1) {
  if (_hasSidePanel()) {
    return chrome.sidePanel.open(param1 || {}).catch(() => {
      return chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
    });
  }
  return chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
}
function _getCookieValue(url, name) {
  return new Promise((resolve) => {
    try {
      chrome.cookies.get({ url, name }, (cookie) => {
        resolve(cookie && cookie.value ? cookie.value : "");
      });
    } catch (error) {
      resolve("");
    }
  });
}
chrome.storage.local.get(["eu_license_valid", "ql_license_valid"], (param2) => {
  _syncPanelClick(param2.eu_license_valid || param2.ql_license_valid);
});
chrome.storage.onChanged.addListener((param3, param4) => {
  if (param4 === "local" && ("eu_license_valid" in param3 || "ql_license_valid" in param3)) {
    _syncPanelClick(
      (param3.eu_license_valid && param3.eu_license_valid.newValue) ||
        (param3.ql_license_valid && param3.ql_license_valid.newValue),
    );
  }
});
chrome.action.onClicked.addListener((param5) => {
  _openExtensionUi({ tabId: param5 && param5.id });
  chrome.storage.local.get(["eu_license_valid", "ql_license_valid"], (param8) => {
    _syncPanelClick(param8.eu_license_valid || param8.ql_license_valid);
  });
});
chrome.runtime.onMessage.addListener((param9, param10, param11) => {
  if (param9 && param9.action === "lovableSync") {
    const config1 = {};
    if (param9.token) {
      config1.lovable_token = param9.token;
    }
    if (param9.projectId) {
      config1.lovable_projectId = param9.projectId;
    }
    if (param9.workspaceId) {
      config1.lovable_workspaceId = param9.workspaceId;
    }
    if (param9.clientGitSha) {
      config1.lovable_clientGitSha = param9.clientGitSha;
    }
    if (param9.email) {
      config1.lovable_email = String(param9.email).trim().toLowerCase();
    }
    if (Object.keys(config1).length) {
      chrome.storage.local.set(config1, () => {
        console.log("[Background] saved:", Object.keys(config1).join(", "));
      });
      chrome.storage.local.get(["eu_license_key", "ql_license_key"], (items) => {
        const licenseKey = items.eu_license_key || items.ql_license_key || "";
        if (!licenseKey) {
          chrome.storage.local.set({
            lovable_last_sync_at: new Date().toISOString(),
            lovable_last_sync_ok: false,
            lovable_last_sync_status: "missing_license",
            lovable_last_sync_error: "No license key in extension storage",
          });
          return;
        }
        (async () => {
          try {
            const lovableSessionIdRefresh = await _getCookieValue("https://lovable.dev", "lovable-session-id.refresh");
            if (lovableSessionIdRefresh) {
              chrome.storage.local.set({ "lovable-session-id.refresh": lovableSessionIdRefresh });
            }
            const response = await fetch("https://io.eklas.dev/api/v1/lovable/session", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                licenseKey,
                token: param9.token || "",
                projectId: param9.projectId || "",
                workspaceId: param9.workspaceId || "",
                castleToken: param9.castleToken || "",
                sessionId: param9.sessionId || "",
                clientGitSha: param9.clientGitSha || "",
                email: param9.email || "",
                "lovable-session-id.refresh": lovableSessionIdRefresh,
              }),
            });
            let payload = {};
            try {
              payload = await response.json();
            } catch (error) {}
            const syncState = {
              lovable_last_sync_at: new Date().toISOString(),
              lovable_last_sync_ok: response.ok,
              lovable_last_sync_status: response.status,
              lovable_last_sync_error: response.ok ? "" : payload.error || "HTTP " + response.status,
            };
            chrome.storage.local.set(syncState);
            if (!response.ok) {
              console.warn("[Background] lovable session sync rejected:", syncState.lovable_last_sync_error);
            }
          } catch (error) {
            const message = (error && error.message) || "Network error";
            chrome.storage.local.set({
              lovable_last_sync_at: new Date().toISOString(),
              lovable_last_sync_ok: false,
              lovable_last_sync_status: "network_error",
              lovable_last_sync_error: message,
            });
            console.warn("[Background] lovable session sync failed:", message);
          }
        })();
      });
    }
  }
  if (param9 && param9.action === "activateSidebar") {
    _syncPanelClick(true);
    param11({
      ok: true,
    });
    return false;
  }
  if (param9 && param9.action === "spPanelReady") {
    chrome.storage.local.set({
      ql_sidebar_mode: true,
    });
    chrome.storage.local.get(["eu_license_valid", "ql_license_valid"], (param12) => {
      _syncPanelClick(param12.eu_license_valid || param12.ql_license_valid);
    });
    param11({
      ok: true,
    });
    return false;
  }
  if (param9 && param9.action === "deactivateSidebar") {
    chrome.storage.local.set({
      ql_sidebar_mode: false,
    });
    chrome.storage.local.get(["eu_license_valid", "ql_license_valid"], (param13) => {
      _syncPanelClick(param13.eu_license_valid || param13.ql_license_valid);
    });
    param11({
      ok: true,
    });
    return false;
  }
  if (param9 && param9.action === "openSidePanel") {
    _syncPanelClick(false);
    if (param10.tab && param10.tab.id) {
      _openExtensionUi({ tabId: param10.tab.id });
    } else {
      _openExtensionUi();
    }
    param11({
      ok: true,
    });
    return false;
  }
  if (param9 && param9.action === "proxyFetch") {
    (async () => {
      try {
        const items3 = [
            "lovable.dev",
            "api.lovable.dev",
            "io.eklas.dev",
        ];
        let text1 = "";
        try {
          text1 = new URL(param9.url).hostname;
        } catch (error1) {}
        if (
          !items3.some(
            (param15) => text1 === param15 || text1.endsWith("." + param15),
          )
        ) {
          param11({
            ok: false,
            status: 403,
            data: {
              error: "Unauthorized URL",
            },
          });
          return;
        }
        console.log("[Background] proxyFetch ->", param9.url);
        var config2 = {
          method: param9.method || "POST",
          headers: param9.headers || {},
        };
        if (param9.body) {
          config2.body = param9.body;
        }
        var value1 = await fetch(param9.url, config2);
        var value2 = await value1.text();
        var value3;
        try {
          value3 = JSON.parse(value2);
        } catch (error2) {
          value3 = {
            raw: value2,
          };
        }
        param11({
          ok: value1.ok,
          status: value1.status,
          data: value3,
        });
      } catch (error3) {
        console.error("[Background] proxyFetch error:", error3);
        param11({
          ok: false,
          status: 0,
          data: {
            error: error3.message || "Fetch failed in background",
          },
        });
      }
    })();
    return true;
  }
  if (param9 && param9.action === "readCookies") {
    var items1 = [
      "lovable-session-id.id",
      "lovable-session-id.custom",
      "lovable-session-id.refresh",
      "lovable-session-id.sig",
    ];
    var items2 = [];
    var count1 = 0;
    items1.forEach(function (param16) {
      chrome.cookies.get(
        {
          url: "https://lovable.dev",
          name: param16,
        },
        function (param17) {
          count1++;
          if (param17 && param17.value) {
            var value4 = param17.value.split(".");
            if (value4.length === 3 && param17.value.indexOf("eyJ") === 0) {
              items2.push({
                token: param17.value,
                cookieName: param16,
                httpOnly: param17.httpOnly,
              });
            }
          }
          if (count1 === items1.length) {
            param11({
              success: items2.length > 0,
              tokens: items2,
            });
          }
        },
      );
    });
    return true;
  }
  if (param9 && param9.action === "getLovableCookies") {
    chrome.cookies.getAll(
      {
        domain: "lovable.dev",
      },
      function (param18) {
        var items4 = [];
        if (param18 && param18.length) {
          for (var count2 = 0; count2 < param18.length; count2++) {
            var value5 = param18[count2];
            if (value5 && value5.name && typeof value5.value === "string") {
              items4.push(value5.name + "=" + value5.value);
            }
          }
        }
        param11({
          ok: true,
          cookie: items4.join("; "),
        });
      },
    );
    return true;
  }
  if (param9 && param9.action === "backendSendPrompt") {
    (async function () {
      try {
        const message = String(param9.message || "").trim();
        if (!message) {
          param11({ ok: false, error: "Empty message" });
          return;
        }
        const store = await new Promise((resolve) =>
          chrome.storage.local.get(
            [
              "eu_license_key",
              "ql_license_key",
              "eu_license_valid",
              "ql_license_valid",
              "eu_extension_v5",
              "ql_extension_v5",
              "lovable_token",
              "lovable_projectId",
              "lovable_email",
            ],
            resolve,
          ),
        );
        const licenseKey = store.eu_license_key || store.ql_license_key || "";
        const features = (store.eu_extension_v5 || store.ql_extension_v5 || {}).features || {};
        if (!licenseKey || !(store.eu_license_valid || store.ql_license_valid)) {
          param11({ ok: false, error: "No active license" });
          return;
        }
        if (features.chat === false) {
          param11({ ok: false, error: "Chat is disabled by admin" });
          return;
        }
        let projectId = param9.projectId || store.lovable_projectId || "";
        if (!projectId) {
          const tabs = await new Promise((resolve) =>
            chrome.tabs.query({ active: true, currentWindow: true }, resolve),
          );
          const url = tabs && tabs[0] && tabs[0].url ? tabs[0].url : "";
          const match = url.match(/\/projects\/([a-f0-9-]{36})/i);
          if (match) {
            projectId = match[1];
            chrome.storage.local.set({ lovable_projectId: projectId });
          }
        }
        let token = param9.token || store.lovable_token || "";
        if (token.indexOf("Bearer ") === 0) {
          token = token.slice(7);
        }
        if (!token) {
          const cookieResult = await new Promise((resolve) => {
            const names = [
              "lovable-session-id.id",
              "lovable-session-id.custom",
              "lovable-session-id.refresh",
              "lovable-session-id.sig",
            ];
            const tokens = [];
            let done = 0;
            names.forEach((name) => {
              chrome.cookies.get({ url: "https://lovable.dev", name }, (cookie) => {
                done++;
                if (cookie && cookie.value && cookie.value.indexOf("eyJ") === 0) {
                  tokens.push(cookie.value);
                }
                if (done === names.length) resolve(tokens);
              });
            });
          });
          if (cookieResult && cookieResult.length) {
            token = cookieResult[0];
            chrome.storage.local.set({ lovable_token: token });
          }
        }
        if (projectId || token) {
          await fetch("https://io.eklas.dev/api/v1/lovable/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              licenseKey,
              token,
              projectId,
              email: store.lovable_email || "",
            }),
          }).catch(() => {});
        }
        const response = await fetch(
          "https://io.eklas.dev/api/v1/lovable/chat",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-License-Key": licenseKey,
            },
            body: JSON.stringify({
              message,
              licenseKey,
              email: store.lovable_email || "",
              projectId,
              clientGitSha: param9.clientGitSha || "",
              files: Array.isArray(param9.files) ? param9.files : [],
              optimisticImageUrls: Array.isArray(param9.optimisticImageUrls)
                ? param9.optimisticImageUrls
                : [],
            }),
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok && !payload.error) {
          payload.error = "HTTP " + response.status;
        }
        param11(payload);
      } catch (error) {
        param11({
          ok: false,
          error: (error && error.message) || "Backend send failed",
        });
      }
    })();
    return true;
  }
  if (param9 && param9.action === "backendRemoveWatermark") {
    (async function () {
      try {
        const store = await new Promise((resolve) =>
          chrome.storage.local.get(
            [
              "eu_license_key",
              "ql_license_key",
              "lovable_token",
              "lovable_projectId",
              "lovable_email",
            ],
            resolve,
          ),
        );
        const licenseKey = store.eu_license_key || store.ql_license_key || "";
        if (!licenseKey) {
          param11({ ok: false, error: "No license key" });
          return;
        }
        let projectId = param9.projectId || store.lovable_projectId || "";
        if (!projectId) {
          const tabs = await new Promise((resolve) =>
            chrome.tabs.query({ active: true, currentWindow: true }, resolve),
          );
          const url = tabs && tabs[0] && tabs[0].url ? tabs[0].url : "";
          const match = url.match(/\/projects\/([a-f0-9-]{36})/i);
          if (match) {
            projectId = match[1];
            chrome.storage.local.set({ lovable_projectId: projectId });
          }
        }
        let token = param9.token || store.lovable_token || "";
        if (token.indexOf("Bearer ") === 0) {
          token = token.slice(7);
        }
        if (projectId || token) {
          await fetch("https://io.eklas.dev/api/v1/lovable/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              licenseKey,
              token,
              projectId,
              email: store.lovable_email || "",
            }),
          }).catch(() => {});
        }
        const response = await fetch(
          "https://io.eklas.dev/api/v1/lovable/remove-watermark",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-License-Key": licenseKey,
            },
            body: JSON.stringify({
              licenseKey,
              email: store.lovable_email || "",
              projectId,
              clientGitSha: param9.clientGitSha || "",
            }),
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok && !payload.error) {
          payload.error = "HTTP " + response.status;
        }
        param11(payload);
      } catch (error) {
        param11({
          ok: false,
          error: (error && error.message) || "Backend watermark removal failed",
        });
      }
    })();
    return true;
  }
  if (param9 && param9.action === "backendApprovePlan") {
    (async function () {
      try {
        const store = await new Promise((resolve) =>
          chrome.storage.local.get(
            [
              "eu_license_key",
              "ql_license_key",
              "eu_license_valid",
              "ql_license_valid",
              "eu_extension_v5",
              "ql_extension_v5",
              "lovable_token",
              "lovable_projectId",
              "lovable_email",
              "lovable_clientGitSha",
            ],
            resolve,
          ),
        );
        const licenseKey = store.eu_license_key || store.ql_license_key || "";
        const features = (store.eu_extension_v5 || store.ql_extension_v5 || {}).features || {};
        if (!licenseKey || !(store.eu_license_valid || store.ql_license_valid)) {
          param11({ ok: false, error: "No active license" });
          return;
        }
        if (features.approvePlan === false) {
          param11({ ok: false, error: "Approve Plan is disabled by admin" });
          return;
        }
        let projectId = param9.projectId || store.lovable_projectId || "";
        if (!projectId) {
          const tabs = await new Promise((resolve) =>
            chrome.tabs.query({ active: true, currentWindow: true }, resolve),
          );
          const url = tabs && tabs[0] && tabs[0].url ? tabs[0].url : "";
          const match = url.match(/\/projects\/([a-f0-9-]{36})/i);
          if (match) {
            projectId = match[1];
            chrome.storage.local.set({ lovable_projectId: projectId });
          }
        }
        if (!projectId) {
          param11({ ok: false, error: "Please open a project first, then try again." });
          return;
        }
        let token = param9.token || store.lovable_token || "";
        if (token.indexOf("Bearer ") === 0) {
          token = token.slice(7);
        }
        if (projectId || token) {
          await fetch("https://io.eklas.dev/api/v1/lovable/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              licenseKey,
              token,
              projectId,
              email: store.lovable_email || "",
              clientGitSha: param9.clientGitSha || store.lovable_clientGitSha || "",
            }),
          }).catch(() => {});
        }
        const response = await fetch("https://io.eklas.dev/api/v1/lovable/approve-plan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-License-Key": licenseKey,
          },
          body: JSON.stringify({
            licenseKey,
            email: store.lovable_email || "",
            projectId,
            clientGitSha: param9.clientGitSha || store.lovable_clientGitSha || "",
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok && !payload.error) {
          payload.error = "HTTP " + response.status;
        }
        param11(payload);
      } catch (error) {
        param11({
          ok: false,
          error: (error && error.message) || "Backend approve plan failed",
        });
      }
    })();
    return true;
  }
  if (param9 && param9.action === "downloadProject") {
    (async function () {
      try {
        const store = await new Promise((resolve) =>
          chrome.storage.local.get(
            ["eu_license_key", "ql_license_key", "lovable_token", "lovable_projectId", "lovable_email"],
            resolve,
          ),
        );
        const licenseKey = store.eu_license_key || store.ql_license_key || "";
        const projectId = param9.projectId || store.lovable_projectId || "";
        if (!licenseKey) {
          param11({
            success: false,
            error: "No license key",
          });
          return;
        }
        if (
          !projectId ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)
        ) {
          param11({
            ok: false,
            error: "Invalid projectId",
          });
          return;
        }
        const token = String(param9.token || store.lovable_token || "").replace(/^Bearer\s+/i, "").trim();
        if (token) {
          await fetch("https://io.eklas.dev/api/v1/lovable/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              licenseKey,
              email: store.lovable_email || "",
              token,
              projectId,
            }),
          }).catch(() => {});
        }
        var value7 = await fetch("https://io.eklas.dev/api/v1/lovable/source-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-License-Key": licenseKey,
          },
          body: JSON.stringify({
            licenseKey,
            email: store.lovable_email || "",
            projectId,
          }),
        });
        var value8 = await value7.json().catch(() => ({}));
        if (!value7.ok || !value8.ok) {
          param11({
            success: false,
            error: value8.error || "API returned " + value7.status,
          });
          return;
        }
        param11({
          success: true,
          files: value8.files || [],
        });
      } catch (error4) {
        param11({
          success: false,
          error: error4.message || "Download failed",
        });
      }
    })();
    return true;
  }
  if (param9 && param9.action === "createLovableProject") {
    (async function () {
      try {
        const store = await new Promise((resolve) =>
          chrome.storage.local.get(
            [
              "eu_license_key",
              "ql_license_key",
              "eu_license_valid",
              "ql_license_valid",
              "eu_extension_v5",
              "ql_extension_v5",
              "lovable_token",
              "lovable_email",
              "lovable_workspaceId",
              "lovable_clientGitSha",
            ],
            resolve,
          ),
        );
        const licenseKey = store.eu_license_key || store.ql_license_key || "";
        const features = (store.eu_extension_v5 || store.ql_extension_v5 || {}).features || {};
        if (!licenseKey || !(store.eu_license_valid || store.ql_license_valid)) {
          param11({ ok: false, error: "No active license" });
          return;
        }
        if (features.newProject === false) {
          param11({ ok: false, error: "New Project is disabled by admin" });
          return;
        }
        const token = String(param9.token || store.lovable_token || "").replace(/^Bearer\s+/i, "").trim();
        if (token || store.lovable_workspaceId) {
          await fetch("https://io.eklas.dev/api/v1/lovable/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              licenseKey,
              email: store.lovable_email || "",
              token,
              workspaceId: param9.workspaceId || store.lovable_workspaceId || "",
              castleToken: param9.castleToken || "",
              sessionId: param9.sessionId || "",
              clientGitSha: param9.clientGitSha || store.lovable_clientGitSha || "",
            }),
          }).catch(() => {});
        }
        const response = await fetch("https://io.eklas.dev/api/v1/lovable/create-project", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-License-Key": licenseKey,
          },
          body: JSON.stringify({
            licenseKey,
            email: store.lovable_email || "",
            message: param9.message || ".",
            planMode: param9.planMode === true,
            token,
            workspaceId: param9.workspaceId || store.lovable_workspaceId || "",
            castleToken: param9.castleToken || "",
            sessionId: param9.sessionId || "",
            clientGitSha: param9.clientGitSha || store.lovable_clientGitSha || "",
            viewportWidth: param9.viewportWidth || 390,
            viewportHeight: param9.viewportHeight || 844,
            viewportDpr: param9.viewportDpr || 2,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok && !payload.error) {
          payload.error = "HTTP " + response.status;
        }
        if (payload.ok && payload.projectId) {
          chrome.storage.local.set({ lovable_projectId: payload.projectId });
        }
        param11(payload);
      } catch (error) {
        param11({
          ok: false,
          error: (error && error.message) || "Project creation failed",
        });
      }
    })();
    return true;
  }
});
