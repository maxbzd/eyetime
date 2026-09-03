(function () {
  let value346 = null;
  let value347 = null;
  let value348 = null;
  let value349 = null;
  let value350 = null;
  let value351 = null;
  let value352 = null;
  let qlNativeGuardActive = false;
  let qlNativeGuardReason = "";
  let qlLicensed = false;
  let items12 = [];
  window.addEventListener("message", function (param180) {
    if (param180.source !== window || !param180.data) {
      return;
    }
    if (param180.data.type === "qlNativeGuardState") {
      qlNativeGuardActive = !!param180.data.active;
      qlNativeGuardReason = String(param180.data.reason || "");
      qlLicensed = !!param180.data.licensed;
      return;
    }
    if (param180.data.type !== "lovableSendViaWs") {
      return;
    }
    const value348 = items12.filter(
      (param181) => param181.ws.readyState === WebSocket.OPEN,
    );
    if (!value348.length) {
      console.warn("[eklas] No open WebSocket for injection");
      window.postMessage(
        {
          type: "lovableWsSendResult",
          success: false,
          error: "No active WebSocket connection",
        },
        "*",
      );
      return;
    }
    const value349 = value348[value348.length - 1];
    try {
      const value350 =
        typeof param180.data.payload === "string"
          ? param180.data.payload
          : JSON.stringify(param180.data.payload);
      value349.origSend(value350);
      window.postMessage(
        {
          type: "lovableWsSendResult",
          success: true,
        },
        "*",
      );
    } catch (error46) {
      console.warn("[eklas] WS inject error:", error46);
      window.postMessage(
        {
          type: "lovableWsSendResult",
          success: false,
          error: error46.message,
        },
        "*",
      );
    }
  });
  function function16() {
    try {
      const value351 = window.location.pathname.match(
        /projects\/([0-9a-fA-F-]{36})/i,
      );
      if (value351) {
        return value351[1];
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }
  function function17(param182) {
    try {
      const value352 = String(param182).match(/projects\/([0-9a-fA-F-]{36})/i);
      if (value352) {
        return value352[1];
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }
  function function22(param182) {
    try {
      const value353 = String(param182 || "").match(/workspaces\/([^/?#]+)\/projects/i);
      return value353 ? value353[1] : null;
    } catch {
      return null;
    }
  }
  function function23(param182, param183) {
    try {
      if (!param182) {
        return null;
      }
      if (param182 instanceof Headers || typeof param182.get === "function") {
        return param182.get(param183) || param182.get(param183.toLowerCase());
      }
      const value353 = Object.keys(param182).find(
        (param184) => param184.toLowerCase() === param183.toLowerCase(),
      );
      return value353 ? param182[value353] : null;
    } catch {
      return null;
    }
  }
  function qlNativeGuardResponse() {
    const error =
      qlNativeGuardReason === "chat_disabled"
        ? "Chat is disabled by admin"
        : qlNativeGuardReason === "new_project_disabled"
          ? "New Project is disabled by admin"
          : "No active license";
    return new Response(JSON.stringify({ ok: false, error }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
  function qlIsProjectCreateRequest(param183, param184) {
    return (
      param184 === "POST" &&
      /\/workspaces\/[^/?#]+\/projects(?:$|\?)/.test(String(param183 || ""))
    );
  }
  function qlIsProjectChatRequest(param183, param184) {
    return (
      param184 === "POST" &&
      /\/projects\/[0-9a-fA-F-]{36}\/chat(?:$|\?)/.test(String(param183 || ""))
    );
  }
  function qlGuardedFetchRequest(param183) {
    try {
      let value353 =
        typeof param183[0] === "string"
          ? param183[0]
          : (param183[0] && param183[0].url) || "";
      const value354 = param183[0] instanceof Request;
      const value355 = (
        value354
          ? param183[0].method || "GET"
          : (param183[1] || {}).method || "GET"
      ).toUpperCase();
      if (!qlNativeGuardActive) {
        return false;
      }
      return qlIsProjectChatRequest(value353, value355);
    } catch {
      return false;
    }
  }
  function function18(param183, param184, value353 = false, param185 = {}) {
    const value354 = param184 || function16();
    const value355 =
      typeof param183 === "string"
        ? param183.replace(/^Bearer\s+/i, "").trim()
        : null;
    const value356 = param185.workspaceId || function22(param185.url);
    const value357 = param185.castleToken || null;
    const value358 = param185.sessionId || null;
    const value359 = param185.clientGitSha || null;
    let flag7 = false;
    if (value355 && value355 !== value346) {
      value346 = value355;
      flag7 = true;
    }
    const value360 = function21(value355);
    if (value360 && value360 !== value348) {
      value348 = value360;
      flag7 = true;
    }
    if (value354 && value354 !== value347) {
      value347 = value354;
      flag7 = true;
    }
    if (value356 && value356 !== value349) {
      value349 = value356;
      flag7 = true;
    }
    if (value357 && value357 !== value350) {
      value350 = value357;
      flag7 = true;
    }
    if (value358 && value358 !== value351) {
      value351 = value358;
      flag7 = true;
    }
    if (value359 && value359 !== value352) {
      value352 = value359;
      flag7 = true;
    }
    if (!flag7 && !value353) {
      return;
    }
    window.postMessage(
      {
        type: "lovableTokenFound",
        token: value346,
        projectId: value347,
        email: value348,
        workspaceId: value349,
        castleToken: value350,
        sessionId: value351,
        clientGitSha: value352,
      },
      window.location.origin,
    );
  }
  function function21(param186) {
    try {
      const value356 = String(param186 || "").split(".");
      if (value356.length < 2) {
        return null;
      }
      const value357 = value356[1].replace(/-/g, "+").replace(/_/g, "/");
      const value358 = value357 + "=".repeat((4 - (value357.length % 4)) % 4);
      const value359 = JSON.parse(atob(value358));
      const value360 = String(value359.email || "").trim().toLowerCase();
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value360) ? value360 : null;
    } catch {
      return null;
    }
  }
  function function19(param186) {
    return new Promise(function (param187, param188) {
      const value356 =
        "lovable-backend-chat-" +
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2);
      const value357 = setTimeout(function () {
        window.removeEventListener("message", function20);
        param188(new Error("Backend chat timeout"));
      }, 30000);
      function function20(param189) {
        if (param189.source !== window || !param189.data) {
          return;
        }
        if (
          param189.data.type !== "lovableBackendChatResult" ||
          param189.data.requestId !== value356
        ) {
          return;
        }
        clearTimeout(value357);
        window.removeEventListener("message", function20);
        param187(param189.data.result || {});
      }
      window.addEventListener("message", function20);
      window.postMessage(
        {
          type: "lovableBackendChatRequest",
          requestId: value356,
          payload: param186,
        },
        window.location.origin,
      );
    });
  }
  function qlCreateProjectThroughBackend(payload) {
    return new Promise(function (resolve, reject) {
      const requestId =
        "lovable-backend-create-" +
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2);
      const timeout = setTimeout(function () {
        window.removeEventListener("message", onResult);
        reject(new Error("Backend project creation timeout"));
      }, 60000);
      function onResult(event) {
        if (event.source !== window || !event.data) {
          return;
        }
        if (
          event.data.type !== "lovableBackendCreateProjectResult" ||
          event.data.requestId !== requestId
        ) {
          return;
        }
        clearTimeout(timeout);
        window.removeEventListener("message", onResult);
        resolve(event.data.result || {});
      }
      window.addEventListener("message", onResult);
      window.postMessage(
        {
          type: "lovableBackendCreateProjectRequest",
          requestId,
          payload,
        },
        window.location.origin,
      );
    });
  }
  window.addEventListener("message", (param185) => {
    if (param185.source !== window) {
      return;
    }
    if (!param185.data || param185.data.type !== "lovableRequestToken") {
      return;
    }
    function18(value346, function16() || value347, true);
  });
  (function callback6() {
    try {
      const value356 = window.fetch;
      window.fetch = async function (...value357) {
        if (qlGuardedFetchRequest(value357)) {
          return qlNativeGuardResponse();
        }
        try {
          let value359 =
            typeof value357[0] === "string"
              ? value357[0]
              : (value357[0] && value357[0].url) || "";
          let value360 = value357[1] || {};
          let value361 = null;
          const value362 = value357[0] instanceof Request;
          if (value362) {
            value359 = value357[0].url || value359;
            value361 =
              value357[0].headers &&
              typeof value357[0].headers.get === "function"
                ? value357[0].headers.get("Authorization") ||
                  value357[0].headers.get("authorization")
                : null;
          }
          const value358 = value362 ? value357[0].headers : value360.headers;
          if (value358) {
            value361 = function23(value358, "Authorization");
          }
          const value363 = function17(value359);
          if (value361 && value361.startsWith("Bearer ")) {
            const value364 = value361.slice(7);
            function18(value364, value363, false, {
              url: value359,
              workspaceId: function22(value359),
              castleToken: function23(value358, "x-castle-request-token"),
              sessionId: function23(value358, "x-browser-session-id"),
              clientGitSha: function23(value358, "x-client-git-sha"),
            });
          }
        } catch (error47) {}
        try {
          const value393 =
            typeof value357[0] === "string"
              ? value357[0]
              : (value357[0] && value357[0].url) || "";
          const value394 = value357[0] instanceof Request;
          const value395 = (
            value394
              ? value357[0].method || "GET"
              : (value357[1] || {}).method || "GET"
          ).toUpperCase();
          const value396 = function17(value393);
          if (
            qlLicensed &&
            value396 &&
            value395 === "POST" &&
            /\/projects\/[0-9a-fA-F-]{36}\/chat(?:$|\?)/.test(value393)
          ) {
            let value397 = "";
            let value398 = null;
            if (value394) {
              value397 = await value357[0].clone().text();
              value398 =
                value357[0].headers &&
                typeof value357[0].headers.get === "function"
                  ? value357[0].headers.get("Authorization") ||
                    value357[0].headers.get("authorization")
                  : null;
            } else {
              value397 = (value357[1] && value357[1].body) || "";
              const value399 = (value357[1] && value357[1].headers) || {};
              value398 =
                value399 instanceof Headers
                  ? value399.get("Authorization") || value399.get("authorization")
                  : value399.Authorization || value399.authorization || null;
            }
            const value400 = value397 ? JSON.parse(value397) : {};
            const value401 = String(value400.message || value400.prompt || value400.content || "").trim();
            if (value401) {
              const value402 = value398
                ? String(value398).replace(/^Bearer\s+/i, "").trim()
                : value346 || "";
              const value404 = value357[0] instanceof Request
                ? value357[0].headers
                : (value357[1] && value357[1].headers) || {};
              function18(value402, value396, true, {
                url: value393,
                workspaceId: function22(value393),
                castleToken: function23(value404, "x-castle-request-token"),
                sessionId: function23(value404, "x-browser-session-id"),
                clientGitSha: function23(value404, "x-client-git-sha"),
              });
              const value403 = await function19({
                message: value401,
                token: value402,
                projectId: value396,
                files: Array.isArray(value400.files) ? value400.files : [],
                optimisticImageUrls: Array.isArray(value400.optimisticImageUrls)
                  ? value400.optimisticImageUrls
                  : [],
              });
              if (value403 && value403.ok) {
                return new Response(
                  JSON.stringify({
                    ok: true,
                    status: 202,
                    accepted: true,
                  }),
                  {
                    status: 202,
                    statusText: "Accepted",
                    headers: { "content-type": "application/json" },
                  },
                );
              }
              return new Response(
                JSON.stringify({
                  ok: false,
                  error: (value403 && value403.error) || "Backend chat failed",
                }),
                {
                  status: (value403 && value403.status) || 502,
                  headers: { "content-type": "application/json" },
                },
              );
            }
          }
        } catch (error57) {
          console.warn("[eklas] backend chat bridge error:", error57);
        }
        const value358 = await value356.apply(this, value357);
        try {
          const value385 =
            typeof value357[0] === "string"
              ? value357[0]
              : (value357[0] && value357[0].url) || "";
          const value386 =
            value385 &&
            (value385.includes("api.lovable.dev") ||
              value385.includes("lovable.dev"));
          const value387 = ((value357[1] || {}).method || "GET").toUpperCase();
          if (value386 && value387 === "POST") {
            const value388 = value358.clone();
            value388
              .text()
              .then(function (param188) {
              })
              .catch(function () {});
          }
        } catch (error51) {}
        try {
          const value389 =
            typeof value357[0] === "string"
              ? value357[0]
              : (value357[0] && value357[0].url) || "";
          const value390 = (
            value357[0] instanceof Request
              ? value357[0].method || "GET"
              : (value357[1] || {}).method || "GET"
          ).toUpperCase();
          if (
            qlLicensed &&
            value358 &&
            value358.ok &&
            qlIsProjectCreateRequest(value389, value390)
          ) {
            value358
              .clone()
              .json()
              .then(function (param189) {
                const value391 = String(
                  (param189 && (param189.id || param189.project_id)) || "",
                );
                if (!value391) return;
                try {
                  sessionStorage.setItem(
                    "ql_autostop_project",
                    JSON.stringify({ id: value391, t: Date.now() }),
                  );
                } catch (error54) {}
                window.postMessage(
                  { type: "qlProjectCreated", projectId: value391 },
                  "*",
                );
              })
              .catch(function () {});
          }
        } catch (error55) {}
        return value358;
      };
    } catch (error52) {
      console.warn("[eklas] fetch error", error52);
    }
  })();
  (function callback7() {
    try {
      const value389 = XMLHttpRequest.prototype.open;
      const value390 = XMLHttpRequest.prototype.setRequestHeader;
      XMLHttpRequest.prototype.open = function (param189, param190) {
        this._lovable_url = param190;
        return value389.apply(this, arguments);
      };
      XMLHttpRequest.prototype.setRequestHeader = function (
        param191,
        param192,
      ) {
        if (
          param191 &&
          param191.toLowerCase() === "authorization" &&
          param192 &&
          param192.startsWith("Bearer ")
        ) {
          const value391 = param192.slice(7);
          function18(value391, function17(this._lovable_url));
        }
        return value390.apply(this, arguments);
      };
    } catch (error53) {
      console.warn("[eklas] xhr error", error53);
    }
  })();
  setInterval(() => {
    const value392 = function16();
    const value393 = value392 && value392 !== value347;
    if (value393) {
      value347 = value392;
      window.postMessage(
        {
          type: "lovableTokenFound",
          token: value346,
          projectId: value392,
        },
        window.location.origin,
      );
    }
  }, 1500);
  (function callback8() {
    try {
      const value394 = window.WebSocket;
      function function19(param193, param194) {
        const value395 = param194
          ? new value394(param193, param194)
          : new value394(param193);
        const value396 = String(param193);
        const value397 = value395.send.bind(value395);
        const value398 = value396
          .replace(/token=[^&]+/g, "token=***")
          .replace(/key=[^&]+/g, "key=***");
        const value399 =
          value396.includes("lovable") ||
          value396.includes("trajectory") ||
          value396.includes("supabase") ||
          value396.includes("convex");
        if (value399) {
          items12 = items12.filter(
            (param195) => param195.ws.readyState !== WebSocket.CLOSED,
          );
          items12.push({
            ws: value395,
            origSend: value397,
          });
          window.postMessage(
            {
              type: "lovableWsConnected",
              url: value398,
            },
            "*",
          );
        }
        value395.send = function (param196) {
          return value397(param196);
        };
        return value395;
      }
      try {
        Object.defineProperty(window, "WebSocket", {
          value: function19,
          writable: true,
          configurable: true,
        });
      } catch (error59) {
        window.WebSocket = function19;
      }
      function19.prototype = value394.prototype;
      function19.CONNECTING = value394.CONNECTING;
      function19.OPEN = value394.OPEN;
      function19.CLOSING = value394.CLOSING;
      function19.CLOSED = value394.CLOSED;
      if (window.WebSocket !== function19) {
        console.warn(
          "[eklas] ⚠️ WebSocket NOT replaced - property blocked!",
        );
      } else {
      }
    } catch (error60) {
      console.warn("[eklas] error ws wrap", error60);
    }
  })();
})();
