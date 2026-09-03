const SVG_ICONS = {
  clock:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
};

let qlExtensionContextDead = false;
let qlNativeGuardTimer = null;
let qlSpecialMessageObserver = null;
const QL_SPECIAL_MESSAGE_LABEL = "Lovable";

function qlRenderSpecialMessagesAsLovable(root) {
  const scope = root && root.querySelectorAll ? root : document;
  const messages = [];
  if (root && root.nodeType === Node.ELEMENT_NODE && root.matches(".special-message")) {
    messages.push(root);
  }
  scope.querySelectorAll(".special-message").forEach((message) => messages.push(message));
  messages.forEach((message) => {
    if (message.textContent !== QL_SPECIAL_MESSAGE_LABEL) {
      message.textContent = QL_SPECIAL_MESSAGE_LABEL;
    }
  });
}

function qlStartSpecialMessageRenderer() {
  qlRenderSpecialMessagesAsLovable(document);
  if (qlSpecialMessageObserver) qlSpecialMessageObserver.disconnect();
  qlSpecialMessageObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "characterData") {
        const message = mutation.target.parentElement?.closest(".special-message");
        if (message) qlRenderSpecialMessagesAsLovable(message);
        return;
      }
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          qlRenderSpecialMessagesAsLovable(node);
        }
      });
    });
  });
  qlSpecialMessageObserver.observe(document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

function qlIsIgnoredExtensionError(value) {
  const message = String((value && (value.message || value.reason || value.error)) || value || "");
  return message.includes("Extension context invalidated") || message.includes("Receiving end does not exist") || message.includes("Could not establish connection");
}
function qlRuntimeAvailable() {
  try {
    return !qlExtensionContextDead && !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch (error) {
    qlExtensionContextDead = true;
    return false;
  }
}
function qlMarkContextDead() {
  qlExtensionContextDead = true;
  if (qlNativeGuardTimer) {
    clearInterval(qlNativeGuardTimer);
    qlNativeGuardTimer = null;
  }
  if (qlHeartbeatInterval) {
    clearInterval(qlHeartbeatInterval);
    qlHeartbeatInterval = null;
  }
}
function qlSafeStorageSet(value) {
  if (!qlRuntimeAvailable()) return;
  try {
    chrome.storage.local.set(value);
  } catch (error) {
    if (qlIsIgnoredExtensionError(error)) qlMarkContextDead();
  }
}
function qlSafeRuntimeSendMessage(message, callback) {
  if (!qlRuntimeAvailable() || typeof chrome.runtime.sendMessage !== "function") {
    if (callback) callback({ ok: false, error: "Extension context unavailable" });
    return;
  }
  try {
    chrome.runtime.sendMessage(message, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError && qlIsIgnoredExtensionError(lastError)) {
        qlMarkContextDead();
      }
      if (callback) callback(response);
    });
  } catch (error) {
    if (qlIsIgnoredExtensionError(error)) qlMarkContextDead();
    if (callback) callback({ ok: false, error: error.message || String(error) });
  }
}
window.addEventListener("error", (event) => {
  if (qlIsIgnoredExtensionError(event.error || event.message)) {
    qlMarkContextDead();
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);
window.addEventListener("unhandledrejection", (event) => {
  if (qlIsIgnoredExtensionError(event.reason)) {
    qlMarkContextDead();
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

function activateBypass() {
  try {
    localStorage.setItem("__ql_bypass_active", "1");
  } catch (error5) {}
  window.postMessage(
    {
      type: "qlBypassState",
      active: true,
    },
    "*",
  );
}
function deactivateBypass() {
  try {
    localStorage.removeItem("__ql_bypass_active");
  } catch (error6) {}
  window.postMessage(
    {
      type: "qlBypassState",
      active: false,
    },
    "*",
  );
}
let qlSessionId = null;
let qlHeartbeatInterval = null;
let qlUserName = null;
let qlExpiresAt = null;
let qlActivatedAt = null;
let qlLicenseStatus = null;
let qlOnlineCount = 0;
let qlMinimized = false;
let qlHeight = 520;
let qlSpeechRecognition = null;
let qlIsRecording = false;
let qlDeviceId = null;
let qlShieldActive = false;
let qlSidebarActivateTimer = null;
let _qlLastStartupHb = 0;
let qlActiveTab = "prompt";
let qlChatHistory = [];
const QL_HISTORY_KEY = "ql_chat_history";
const QL_MAX_HISTORY = 200;
function createUI() {
  const existing = document.getElementById("ql-floating");
  if (existing) existing.remove();
  if (qlRuntimeAvailable()) {
    try {
      chrome.storage.local.set({
        ql_native_chat: false,
        ql_sidebar_mode: true,
      });
    } catch (error) {
      if (qlIsIgnoredExtensionError(error)) qlMarkContextDead();
    }
  }
  removeShieldOverlay();
  cleanupNativeChatArtifacts();
  qlRetryCount = qlRetryDelays.length;
}
let qlNativeGuardState = {
  active: false,
  reason: "",
};
function qlIsProjectPage() {
  return /\/projects\/[a-f0-9-]{36}/i.test(window.location.pathname || "");
}
function qlNativeGuardMessage() {
  if (qlNativeGuardState.reason === "chat_disabled") {
    return {
      title: "Chat disabled",
      body: "This prompt box is disabled by the extension administrator.",
    };
  }
  if (qlNativeGuardState.reason === "new_project_disabled") {
    return {
      title: "New projects disabled",
      body: "Creating new projects is disabled by the extension administrator.",
    };
  }
  return {
    title: "License required",
    body: "Activate your license in the Lovable extension to use this prompt box.",
  };
}
function qlCandidateNativeForms() {
  const forms = new Set();
  document.querySelectorAll("form#chat-input, form").forEach((form) => {
    const text = form.textContent || "";
    if (
      form.id === "chat-input" ||
      form.querySelector("textarea,[contenteditable='true']") ||
      /build|queue follow-up|what.*vision/i.test(text)
    ) {
      forms.add(form);
    }
  });
  document.querySelectorAll("textarea,[contenteditable='true']").forEach((input) => {
    const form = input.closest("form");
    if (form) forms.add(form);
  });
  return [...forms].filter((form) => form && !form.closest("#ql-floating") && !form.closest(".sp-body"));
}
function qlDisableNativeForm(form) {
  if (!form || form.dataset.qlLicenseGuarded === "true") return;
  form.dataset.qlLicenseGuarded = "true";
  const computed = getComputedStyle(form);
  if (computed.position === "static") {
    form.dataset.qlLicenseGuardPosition = "";
    form.style.position = "relative";
  } else {
    form.dataset.qlLicenseGuardPosition = computed.position;
  }
  form.querySelectorAll("input,button,textarea,[contenteditable]").forEach((item) => {
    item.dataset.qlLicenseGuardDisabled = item.disabled ? "true" : "false";
    item.dataset.qlLicenseGuardTabindex = item.getAttribute("tabindex") || "";
    item.setAttribute("tabindex", "-1");
    if (item.tagName !== "DIV") item.disabled = true;
    if (item.contentEditable === "true") {
      item.dataset.qlLicenseGuardEditable = "true";
      item.contentEditable = "false";
    }
  });
  const copy = qlNativeGuardMessage();
  const overlay = document.createElement("div");
  overlay.className = "ql-license-guard-overlay";
  overlay.style.cssText =
    "position:absolute;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;padding:12px;border-radius:inherit;background:rgba(10,10,11,0.72);backdrop-filter:blur(10px);pointer-events:all;cursor:not-allowed;";
  overlay.innerHTML =
    '<div style="display:flex;align-items:center;gap:10px;max-width:360px;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,0.96);color:#111827;box-shadow:0 18px 50px rgba(0,0,0,.22);border:1px solid rgba(0,0,0,.08);font-family:Inter,system-ui,sans-serif">' +
    '<div style="width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#ff5a00,#a259ff);color:white;font-weight:900">L</div>' +
    '<div><div style="font-size:13px;font-weight:800;line-height:1.2">' +
    qlEscapeHtml(copy.title) +
    '</div><div style="font-size:11px;color:#6b7280;line-height:1.35;margin-top:2px">' +
    qlEscapeHtml(copy.body) +
    "</div></div></div>";
  ["click", "mousedown", "mouseup", "keydown", "submit", "touchstart"].forEach((eventName) => {
    overlay.addEventListener(
      eventName,
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      },
      true,
    );
  });
  form.appendChild(overlay);
}
function qlEnableNativeForm(form) {
  if (!form || form.dataset.qlLicenseGuarded !== "true") return;
  form.querySelectorAll(".ql-license-guard-overlay").forEach((item) => item.remove());
  form.querySelectorAll("[data-ql-license-guard-disabled]").forEach((item) => {
    item.disabled = item.dataset.qlLicenseGuardDisabled === "true";
    const tabindex = item.dataset.qlLicenseGuardTabindex;
    if (tabindex) item.setAttribute("tabindex", tabindex);
    else item.removeAttribute("tabindex");
    if (item.dataset.qlLicenseGuardEditable === "true") item.contentEditable = "true";
    delete item.dataset.qlLicenseGuardDisabled;
    delete item.dataset.qlLicenseGuardTabindex;
    delete item.dataset.qlLicenseGuardEditable;
  });
  if (form.dataset.qlLicenseGuardPosition === "") form.style.position = "";
  delete form.dataset.qlLicenseGuardPosition;
  delete form.dataset.qlLicenseGuarded;
}
function qlApplyNativeLicenseGuard() {
  qlCandidateNativeForms().forEach((form) => {
    if (qlNativeGuardState.active) qlDisableNativeForm(form);
    else qlEnableNativeForm(form);
  });
  if (!qlNativeGuardState.active) {
    document.querySelectorAll("[data-ql-license-guarded='true']").forEach(qlEnableNativeForm);
  }
}
function qlRefreshNativeLicenseGuard() {
  if (!qlRuntimeAvailable()) {
    qlMarkContextDead();
    return;
  }
  try {
    chrome.storage.local.get(
      ["eu_license_valid", "ql_license_valid", "eu_extension_v5", "ql_extension_v5"],
      (items) => {
      if (!qlRuntimeAvailable()) return;
      const valid = !!(items.eu_license_valid || items.ql_license_valid);
      const features = (items.eu_extension_v5 || items.ql_extension_v5 || {}).features || {};
      let reason = "";
      if (valid && qlIsProjectPage() && features.chat === false) {
        reason = "chat_disabled";
      }
      qlNativeGuardState = {
        active: !!reason,
        reason,
      };
      window.postMessage(
        {
          type: "qlNativeGuardState",
          active: qlNativeGuardState.active,
          reason: qlNativeGuardState.reason,
          licensed: valid,
        },
        "*",
      );
      qlApplyNativeLicenseGuard();
      },
    );
  } catch (error) {
    if (qlIsIgnoredExtensionError(error)) qlMarkContextDead();
  }
}
function qlStartNativeLicenseGuard() {
  qlRefreshNativeLicenseGuard();
  if (qlNativeGuardTimer) clearInterval(qlNativeGuardTimer);
  qlNativeGuardTimer = setInterval(qlRefreshNativeLicenseGuard, 1200);
  try {
    new MutationObserver(() => qlApplyNativeLicenseGuard()).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  } catch (error) {}
}
let qlAutoStopTimer = null;
function qlWatchAutoStopAfterCreate(projectId) {
  if (qlAutoStopTimer) return;
  const deadline = Date.now() + 90000;
  qlAutoStopTimer = setInterval(function () {
    if (Date.now() > deadline) {
      clearInterval(qlAutoStopTimer);
      qlAutoStopTimer = null;
      return;
    }
    if (
      projectId &&
      !(window.location.pathname || "").toLowerCase().includes(projectId.toLowerCase())
    ) {
      return;
    }
    const stopBtn = document.querySelector('button[aria-label="Stop generating"]');
    if (stopBtn && !stopBtn.disabled) {
      stopBtn.click();
      clearInterval(qlAutoStopTimer);
      qlAutoStopTimer = null;
      try {
        sessionStorage.removeItem("ql_autostop_project");
      } catch (error) {}
    }
  }, 250);
}
window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data) return;
  if (event.data.type === "qlProjectCreated") {
    qlWatchAutoStopAfterCreate(String(event.data.projectId || ""));
  }
});
function qlResumeAutoStopAfterReload() {
  try {
    const raw = sessionStorage.getItem("ql_autostop_project");
    if (!raw) return;
    const info = JSON.parse(raw);
    if (info && info.id && Date.now() - (info.t || 0) < 120000) {
      qlWatchAutoStopAfterCreate(String(info.id));
    } else {
      sessionStorage.removeItem("ql_autostop_project");
    }
  } catch (error) {}
}
function qlFriendlyErrorMessage(text) {
  const msg = String(text || "");
  if (
    msg.includes('"status":428') ||
    msg.includes('"type":"captcha_required"') ||
    msg.includes("complete the captcha")
  ) {
    return [
      "Additional verification is required.",
      "",
      "Fix 1: Disable the Extension and Complete the CAPTCHA",
      "Turn off the extension, send a prompt in Lovable, complete the CAPTCHA, then re-enable the extension.",
      "",
      "Fix 2: Change Your IP Address",
      "Connect to a VPN or switch VPN servers, reload Lovable, and try again.",
      "",
      "Fix 3: Sign Out and Back In",
      "Log out of Lovable, sign back in, and send your prompt again.",
    ].join("\n");
  }
  if (msg.includes('"type":"castle_denied"') || msg.includes("suspicious activity")) {
    return [
      "Project creation was blocked due to suspicious activity.",
      "",
      "Fix 2: Change Your IP",
      "Connect to a VPN or switch to a different network, then try creating the Lovable project again.",
      "",
      "Fix 3: Use Another Workspace or Account",
      "Switch to a different Lovable workspace, or sign in with another account and create the project there.",
    ].join("\n");
  }
  if (
    msg.includes('"status":402') ||
    msg.includes("Payment required") ||
    msg.includes("out of credits")
  ) {
    return [
      "You Have 0 Credits",
      "",
      "Important:",
      "The extension will not work with 0 credits. Keep at least 1 credit available in your active workspace.",
      "",
      "Fix 1 (Recommended)",
      "Wait for your 5 free daily credits to reset (up to 24 hours).",
      "",
      "Fix 2",
      "Switch to a workspace with at least 1 available credit, or create a new workspace.",
      "",
      "Fix 3",
      "Use another Lovable account that has available credits.",
      "",
      "Correct Usage",
      "• Reload Lovable after activating your license.",
      '• After sending a prompt, make sure the chat prompt shows "Lovable".',
      '• If it shows your prompt instead of "Lovable", reload the page and try again.',
    ].join("\n");
  }
  if (
    msg.includes('"status":401') ||
    msg.includes('"type":"unauthorized"') ||
    msg.includes("Invalid token") ||
    msg.includes('"status":403') ||
    msg.includes('"type":"forbidden"') ||
    msg.includes("don't have the permissions")
  ) {
    return "Please open a project first, then try again.";
  }
  return null;
}
function qlRewriteNativeErrorDialogs() {
  let nodes;
  try {
    nodes = document.querySelectorAll("p,span,div,pre,code");
  } catch (error) {
    return;
  }
  nodes.forEach((el) => {
    if (el.dataset.qlErrorRewritten === "1") return;
    if (el.children && el.children.length > 0) return;
    const raw = el.textContent || "";
    if (raw.indexOf("request_id") === -1 && raw.indexOf('"status"') === -1) return;
    const friendly = qlFriendlyErrorMessage(raw);
    if (!friendly) return;
    el.dataset.qlErrorRewritten = "1";
    el.style.whiteSpace = "pre-line";
    el.style.textAlign = "left";
    el.textContent = friendly;
  });
}
let qlErrorRewriterObserver = null;
function qlStartNativeErrorRewriter() {
  qlRewriteNativeErrorDialogs();
  if (qlErrorRewriterObserver) qlErrorRewriterObserver.disconnect();
  try {
    qlErrorRewriterObserver = new MutationObserver(() => qlRewriteNativeErrorDialogs());
    qlErrorRewriterObserver.observe(document.documentElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  } catch (error) {}
}
function qlEscapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function removeShieldOverlay() {
  const value107 = document.getElementById("ql-shield-overlay");
  if (value107) {
    value107.remove();
  }
  const value108 = document.querySelector("form#chat-input");
  if (!value108) {
    return;
  }
  const value109 = value108.querySelectorAll("[data-ql-shield-disabled]");
  value109.forEach((param66) => {
    const value110 = param66.dataset.qlShieldDisabled;
    if (value110 === "true") {
      param66.disabled = true;
    } else if (value110 === "" || value110 === "false") {
      param66.disabled = false;
    }
    delete param66.dataset.qlShieldDisabled;
    const value111 = param66.dataset.qlShieldTabindex;
    if (value111) {
      param66.setAttribute("tabindex", value111);
    } else {
      param66.removeAttribute("tabindex");
    }
    delete param66.dataset.qlShieldTabindex;
    if (param66.dataset.qlShieldEditable === "true") {
      param66.contentEditable = "true";
      delete param66.dataset.qlShieldEditable;
    }
  });
}
let qlHbConflictCount = 0;
let qlHbNetworkFailCount = 0;
let qlExpiredHandled = false;
function qlBootstrap() {
  if (document.getElementById("ql-floating")) {
    return;
  }
  if (!document.body) {
    var value121 = new MutationObserver(function () {
      if (document.body) {
        value121.disconnect();
        qlBootstrap();
      }
    });
    value121.observe(document.documentElement, {
      childList: true,
    });
    return;
  }
  createUI();
  qlStartNativeLicenseGuard();
  qlStartSpecialMessageRenderer();
  qlResumeAutoStopAfterReload();
  qlStartNativeErrorRewriter();
}
if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  setTimeout(qlBootstrap, 50);
} else {
  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(qlBootstrap, 50);
  });
}
var qlRetryCount = 0;
var qlRetryDelays = [300, 600, 1000, 1500, 2000, 3000, 4000, 5000];
function qlRetryInit() {
  qlRetryCount = qlRetryDelays.length;
}
qlRetryInit();
try {
chrome.storage.onChanged.addListener((param68, param69) => {
  if (param69 !== "local") {
    return;
  }
  if (
    param68.eu_license_valid ||
    param68.ql_license_valid ||
    param68.eu_extension_v5 ||
    param68.ql_extension_v5
  ) {
    qlRefreshNativeLicenseGuard();
  }
  if (param68.ql_sidebar_mode) {
    if (param68.ql_sidebar_mode.newValue === true) {
      if (qlSidebarActivateTimer) {
        clearTimeout(qlSidebarActivateTimer);
        qlSidebarActivateTimer = null;
      }
      const value123 = document.getElementById("ql-floating");
      if (value123) {
        value123.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        value123.style.opacity = "0";
        value123.style.transform = "scale(0.95)";
        setTimeout(() => {
          if (qlHeartbeatInterval) {
            clearInterval(qlHeartbeatInterval);
          }
          if (window.qlCountdownInterval) {
            clearInterval(window.qlCountdownInterval);
          }
          value123.remove();
        }, 350);
      }
    } else if (param68.ql_sidebar_mode.newValue === false) {
      try {
        if (qlRuntimeAvailable()) chrome.storage.local.set({ ql_sidebar_mode: true });
      } catch (error) {
        if (qlIsIgnoredExtensionError(error)) qlMarkContextDead();
      }
    }
  }
});
} catch (error) {
  if (qlIsIgnoredExtensionError(error)) qlMarkContextDead();
}
function updateSyncStatus() {
  if (!qlRuntimeAvailable()) return;
  try {
  chrome.storage.local.get(
    ["lovable_projectId", "lovable_token"],
    (param70) => {
      const value125 = document.getElementById("ql-sync-status");
      if (!value125) {
        return;
      }
      if (param70.lovable_projectId && param70.lovable_token) {
        value125.className = "ql-sync-status ql-sync-ok";
        const value126 = param70.lovable_projectId.substring(0, 6);
        value125.innerHTML =
          '<span class="ql-sync-text">' +
          t("sync.ok") +
          " " +
          t("sync.project") +
          " " +
          value126 +
          "...</span>";
      } else {
        value125.className = "ql-sync-status ql-sync-waiting";
        value125.innerHTML =
          '<span class="ql-sync-text">' +
          SVG_ICONS.clock +
          t("sync.waiting") +
          "</span>";
      }
    },
  );
  } catch (error) {
    if (qlIsIgnoredExtensionError(error)) qlMarkContextDead();
  }
}
let _qlStorageWatchSetup = false;
function requestLatestTokenFromHook(value127 = 1200) {
  return new Promise((param72) => {
    let flag1 = false;
    function function2(param73) {
      if (flag1) {
        return;
      }
      flag1 = true;
      clearTimeout(value128);
      try {
        if (qlRuntimeAvailable()) chrome.storage.onChanged.removeListener(function3);
      } catch (error) {
        if (qlIsIgnoredExtensionError(error)) qlMarkContextDead();
      }
      param72(param73);
    }
    function function3(param74, param75) {
      if (param75 !== "local") {
        return;
      }
      if (param74.lovable_token && param74.lovable_token.newValue) {
        function2(true);
      }
    }
    const value128 = setTimeout(
      () => function2(false),
      Math.max(300, value127),
    );
    try {
      if (qlRuntimeAvailable()) chrome.storage.onChanged.addListener(function3);
    } catch (error) {
      if (qlIsIgnoredExtensionError(error)) qlMarkContextDead();
      function2(false);
      return;
    }
    try {
      window.postMessage(
        {
          type: "lovableRequestToken",
        },
        "*",
      );
      setTimeout(
        () =>
          window.postMessage(
            {
              type: "lovableRequestToken",
            },
            "*",
          ),
        120,
      );
    } catch (error19) {
      function2(false);
    }
  });
}
function saveChatHistory() {
  if (qlChatHistory.length > QL_MAX_HISTORY) {
    qlChatHistory = qlChatHistory.slice(-QL_MAX_HISTORY);
  }
  qlSafeStorageSet({
    [QL_HISTORY_KEY]: qlChatHistory,
  });
}
function addToChatHistory(param78, param79) {
  qlChatHistory.push({
    text: param78,
    timestamp: new Date().toISOString(),
    status: param79 || "ok",
  });
  saveChatHistory();
  updateHistoryBadge();
}
function updateHistoryBadge() {
  const value129 = document.getElementById("ql-history-badge");
  if (!value129) {
    return;
  }
  if (qlChatHistory.length > 0) {
    value129.textContent = qlChatHistory.length;
    value129.style.display = "inline-flex";
  } else {
    value129.style.display = "none";
  }
}
async function sendPromptThroughBackend(message, options) {
  const opts = options || {};
  if (!hasExtensionRuntime()) {
    throw new Error("Extension was reloaded. Refresh the Lovable tab and try again.");
  }
  const session = {
    token: opts.token || "",
    projectId: opts.projectId || "",
  };
  if (!session.token || !session.projectId) {
    const storedSession = await getStoredLovableTokenAndProject();
    session.token = session.token || storedSession.token || "";
    session.projectId = session.projectId || storedSession.projectId || "";
  }
  if (!session.projectId) {
    const fromUrl = String(window.location.pathname || "").match(/\/projects\/([a-f0-9-]{36})/i);
    if (fromUrl) session.projectId = fromUrl[1];
  }
  if (!session.projectId) {
    throw new Error("Please open a project first, then try again.");
  }
  const response = await new Promise(function (resolve) {
    qlSafeRuntimeSendMessage(
      {
        action: "backendSendPrompt",
        message: message,
        token: session.token || "",
        projectId: session.projectId || "",
        clientGitSha: opts.clientGitSha || "",
        files: Array.isArray(opts.files) ? opts.files : [],
        optimisticImageUrls: Array.isArray(opts.optimisticImageUrls)
          ? opts.optimisticImageUrls
          : [],
      },
      function (payload) {
        resolve(payload || { ok: false, error: "Backend send failed" });
      },
    );
  });
  if (!response.ok) {
    throw new Error(response.error || ("Lovable returned HTTP " + (response.status || "unknown")));
  }
  return response;
}
chrome.runtime.onMessage.addListener(function (param89, param90, param91) {
  if (param90.id !== chrome.runtime.id) {
    return;
  }
  if (param89.action === "qlSendViaWs") {
    sendPromptThroughBackend(param89.message)
      .then(function () {
        param91({
          ok: true,
        });
      })
      .catch(function (param92) {
        param91({
          ok: false,
          error: param92.message,
        });
      });
    return true;
  }
  if (param89.action === "qlActivateNativeChat") {
    activateNativeChat();
    param91({
      ok: true,
    });
    return true;
  }
  if (param89.action === "qlDeactivateNativeChat") {
    deactivateNativeChat();
    param91({
      ok: true,
    });
    return true;
  }
  if (param89.action === "qlActivateBypass") {
    activateBypass();
    param91({
      ok: true,
    });
    return true;
  }
  if (param89.action === "qlDeactivateBypass") {
    deactivateBypass();
    param91({
      ok: true,
    });
    return true;
  }
  if (param89.action === "qlQuickProjectInit") {
    quickProjectInit()
      .then(function () {
        param91({
          ok: true,
        });
      })
      .catch(function (param93) {
        param91({
          ok: false,
          error: param93.message,
        });
      });
    return true;
  }
  if (param89.action === "qlRequestToken") {
    requestLatestTokenFromHook()
      .then(function () {
        param91({
          ok: true,
        });
      })
      .catch(function () {
        param91({
          ok: false,
        });
      });
    return true;
  }
  if (param89.action === "qlPublishProject" || param89.action === "PUBLISH_PROJECT") {
    (async () => {
      try {
        const { token, projectId } = await getStoredLovableTokenAndProject();
        const res = await publishProject({ projectId, token });
        param91(res);
      } catch (err) {
        param91({ ok: false, error: err.message });
      }
    })();
    return true;
  }
  if (param89.action === "qlGetSecurityData" || param89.action === "GET_SECURITY_DATA") {
    (async () => {
      try {
        const { token, projectId } = await getStoredLovableTokenAndProject();
        const res = await getSecurityData({ projectId, token });
        param91(res);
      } catch (err) {
        param91({ ok: false, error: err.message });
      }
    })();
    return true;
  }
  if (param89.action === "qlRunSecurityScan" || param89.action === "RUN_SECURITY_SCAN") {
    (async () => {
      try {
        const { token, projectId } = await getStoredLovableTokenAndProject();
        const res = await runSecurityScan({ projectId, token, force: param89.force });
        param91(res);
      } catch (err) {
        param91({ ok: false, error: err.message });
      }
    })();
    return true;
  }
  if (param89.action === "qlFixAllSecurity" || param89.action === "FIX_ALL_SECURITY") {
    (async () => {
      try {
        const { token, projectId } = await getStoredLovableTokenAndProject();
        const res = await fixAllSecurityFindings({ projectId, token, findings: param89.findings || _lastSecurityFindings });
        param91(res);
      } catch (err) {
        param91({ ok: false, error: err.message });
      }
    })();
    return true;
  }
});
async function quickProjectInit() {
  if (window.location.pathname.match(/\/projects\/[a-f0-9-]{36}/i)) {
    throw new Error(
      "Use this button on the Lovable home screen, with no project open.",
    );
  }
  const value149 = document.querySelector("form#chat-input");
  if (!value149) {
    throw new Error(
      "Form not found. Make sure you are on the Lovable home screen.",
    );
  }
  const value150 = value149.querySelector('[contenteditable="true"]');
  if (!value150) {
    throw new Error("Text field not found.");
  }
  const value151 = document.getElementById("chatinput-send-message-button");
  if (!value151) {
    throw new Error("Create button not found.");
  }
  value150.focus();
  document.execCommand("selectAll", false, null);
  document.execCommand("insertText", false, ".");
  await new Promise((param94) => setTimeout(param94, 300));
  if (value151.disabled) {
    value151.removeAttribute("disabled");
  }
  value151.click();
  const value152 = await new Promise(function (param95) {
    const count7 = 25000;
    const value153 = Date.now();
    const value154 = setInterval(function () {
      if (Date.now() - value153 > count7) {
        clearInterval(value154);
        param95(false);
        return;
      }
      const value155 = document.querySelector(
        'button[aria-label="Stop generating"]',
      );
      if (value155 && !value155.disabled) {
        clearInterval(value154);
        value155.click();
        param95(true);
      }
    }, 200);
  });
  if (!value152) {
    throw new Error(
      "Timeout waiting for Stop. Check if a project was created in your list.",
    );
  }
}
const MAX_FILES = 10;
const MAX_FILE_SIZE = 20971520;
let qlAttachedFiles = [];
let _dragCleanup = null;
let _resizeCleanup = null;
var CURRENT_EXT_VERSION_POPUP = "5.1";
let qlNativeChatActive = false;
let qlNativeChatCleanup = null;
function activateNativeChat() {
  qlNativeChatActive = true;
  qlSafeStorageSet({
    ql_native_chat: true,
  });
  const value266 = document.getElementById("ql-floating");
  if (value266) {
    value266.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    value266.style.opacity = "0";
    value266.style.transform = "scale(0.95) translateX(20px)";
    setTimeout(() => {
      value266.style.display = "none";
    }, 350);
  }
  injectNativeChatOverlay();
}
function deactivateNativeChat() {
  qlNativeChatActive = false;
  qlSafeStorageSet({
    ql_native_chat: false,
  });
  cleanupNativeChatArtifacts();
  const value270 = document.getElementById("ql-floating");
  if (value270) {
    value270.style.display = "";
    value270.style.opacity = "0";
    value270.style.transform = "scale(0.95)";
    requestAnimationFrame(() => {
      value270.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      value270.style.opacity = "1";
      value270.style.transform = "scale(1) translateX(0)";
    });
  }
}
function cleanupNativeChatArtifacts() {
  qlNativeChatActive = false;
  if (qlNativeChatCleanup) {
    qlNativeChatCleanup();
    qlNativeChatCleanup = null;
  }
  const value267 = document.getElementById("ql-native-badge");
  if (value267) {
    value267.remove();
  }
  const value268 = document.getElementById("ql-native-return-btn");
  if (value268) {
    value268.remove();
  }
  const value269 = document.getElementById("chatinput-send-message-button");
  if (value269) {
    value269.classList.remove("ql-native-send-active");
    value269.style.animation = "";
  }
}
function injectNativeChatOverlay() {
  const value271 = document.querySelector("form#chat-input");
  if (!value271) {
    setTimeout(injectNativeChatOverlay, 500);
    return;
  }
  if (!document.getElementById("ql-native-badge")) {
    const value273 = getComputedStyle(value271).position;
    if (value273 === "static") {
      value271.style.position = "relative";
    }
    const value274 = document.createElement("div");
    value274.id = "ql-native-badge";
    value274.className = "ql-native-badge";
    value274.innerHTML = "⚡ <span>Lovable</span>";
    value271.appendChild(value274);
  }
  if (!document.getElementById("ql-native-return-btn")) {
    const value275 = document.createElement("button");
    value275.id = "ql-native-return-btn";
    value275.className = "ql-native-return-btn";
    value275.innerHTML = "← Back to Extension";
    value275.addEventListener("click", (param140) => {
      param140.preventDefault();
      param140.stopPropagation();
      deactivateNativeChat();
    });
    value271.parentElement.insertBefore(value275, value271.nextSibling);
  }
  const value272 = document.getElementById("chatinput-send-message-button");
  if (value272) {
    value272.classList.add("ql-native-send-active");
  }
  function function13(param141) {
    if (!qlNativeChatActive) {
      return;
    }
    const value276 = value271.querySelector('[contenteditable="true"]');
    const value277 = value276
      ? (value276.innerText || value276.textContent || "").trim()
      : "";
    if (value277) {
      addToChatHistory(value277, "ok");
    }
  }
  function function14(param142) {
    if (!qlNativeChatActive) {
      return;
    }
    const value278 = value271.querySelector('[contenteditable="true"]');
    const value279 = value278
      ? (value278.innerText || value278.textContent || "").trim()
      : "";
    if (value279) {
      addToChatHistory(value279, "ok");
    }
  }
  function function15(param143) {
    if (!qlNativeChatActive) {
      return;
    }
    if (param143.key === "Enter" && !param143.shiftKey) {
      const value280 = value271.querySelector('[contenteditable="true"]');
      const value281 = value280
        ? (value280.innerText || value280.textContent || "").trim()
        : "";
      if (value281) {
        addToChatHistory(value281, "ok");
      }
    }
  }
  if (value272) {
    value272.addEventListener("click", function13, true);
  }
  value271.addEventListener("submit", function14, true);
  value271.addEventListener("keydown", function15, true);
  qlNativeChatCleanup = function () {
    if (value272) {
      value272.removeEventListener("click", function13, true);
    }
    value271.removeEventListener("submit", function14, true);
    value271.removeEventListener("keydown", function15, true);
  };
}
qlSafeStorageSet({
  ql_native_chat: false,
});
cleanupNativeChatArtifacts();
window.addEventListener("message", function (param150) {
  if (!param150.data || param150.data.type !== "qlPreviewBuilt") {
    return;
  }
  if (param150.origin !== "https://lovable.dev") {
    return;
  }
  setTimeout(function () {
    const value288 = Array.from(document.querySelectorAll("iframe"));
    const value289 =
      value288.find(function (param151) {
        return (
          param151.src &&
          (param151.src.includes("lovableproject.com") ||
            param151.src.includes("lovable-app") ||
            (param151.src.includes(".lovable.") &&
              !param151.src.includes("lovable.dev")))
        );
      }) ||
      value288.find(function (param152) {
        return (
          param152.src &&
          param152.src.startsWith("https://") &&
          !param152.src.includes("chrome-extension://") &&
          !param152.src.includes("lovable.dev")
        );
      });
    if (value289 && value289.src) {
      const value290 = value289.src;
      value289.src = "";
      setTimeout(function () {
        value289.src = value290;
      }, 100);
    } else {
    }
  }, 2500);
});
window.addEventListener("message", (param153) => {
  if (!param153.data || param153.data.type !== "lovableTokenFound") {
    return;
  }
  if (!isLovableOrigin(param153.origin)) {
    return;
  }
  const config6 = {};
  if (param153.data.token && typeof param153.data.token === "string") {
    config6.lovable_token = param153.data.token
      .replace(/^Bearer\s+/i, "")
      .trim();
  }
  if (param153.data.projectId && typeof param153.data.projectId === "string") {
    config6.lovable_projectId = param153.data.projectId;
  }
  if (param153.data.email && typeof param153.data.email === "string") {
    config6.lovable_email = param153.data.email.trim().toLowerCase();
  }
  if (param153.data.workspaceId && typeof param153.data.workspaceId === "string") {
    config6.lovable_workspaceId = param153.data.workspaceId;
  }
  if (param153.data.clientGitSha && typeof param153.data.clientGitSha === "string") {
    config6.lovable_clientGitSha = param153.data.clientGitSha;
  }
  if (!Object.keys(config6).length) {
    return;
  }
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    try {
      chrome.storage.local.set(config6, () => {
        if (!qlRuntimeAvailable()) return;
      updateSyncStatus();
      setTimeout(updateSyncStatus, 200);
      setTimeout(updateSyncStatus, 800);
      });
    } catch (error) {
      if (qlIsIgnoredExtensionError(error)) qlMarkContextDead();
    }
  }
  if (hasExtensionRuntime()) {
    qlSafeRuntimeSendMessage({
      action: "lovableSync",
      token: config6.lovable_token || "",
      projectId: config6.lovable_projectId || "",
      email: config6.lovable_email || "",
      workspaceId: config6.lovable_workspaceId || "",
      castleToken: param153.data.castleToken || "",
      sessionId: param153.data.sessionId || "",
      clientGitSha: config6.lovable_clientGitSha || "",
    });
  }
});
window.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "lovableBackendChatRequest") {
    return;
  }
  if (!isLovableOrigin(event.origin)) {
    return;
  }
  const requestId = event.data.requestId;
  const payload = event.data.payload || {};
  sendPromptThroughBackend(payload.message || "", {
    token: payload.token || "",
    projectId: payload.projectId || "",
    files: Array.isArray(payload.files) ? payload.files : [],
    optimisticImageUrls: Array.isArray(payload.optimisticImageUrls)
      ? payload.optimisticImageUrls
      : [],
  })
    .then((result) => {
      window.postMessage(
        {
          type: "lovableBackendChatResult",
          requestId,
          result: result || { ok: true },
        },
        window.location.origin,
      );
    })
    .catch((error) => {
      window.postMessage(
        {
          type: "lovableBackendChatResult",
          requestId,
          result: {
            ok: false,
            error: error && error.message ? error.message : "Backend chat failed",
          },
        },
        window.location.origin,
      );
    });
});

window.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "lovableBackendCreateProjectRequest") {
    return;
  }
  if (!isLovableOrigin(event.origin)) {
    return;
  }
  const requestId = event.data.requestId;
  const payload = event.data.payload || {};
  qlSafeRuntimeSendMessage(
    {
      action: "createLovableProject",
      message: payload.message || ".",
      token: payload.token || "",
      workspaceId: payload.workspaceId || "",
      castleToken: payload.castleToken || "",
      sessionId: payload.sessionId || "",
      clientGitSha: payload.clientGitSha || "",
      planMode: payload.planMode === true,
      viewportWidth: payload.viewportWidth || 390,
      viewportHeight: payload.viewportHeight || 844,
      viewportDpr: payload.viewportDpr || 2,
    },
    (result) => {
      window.postMessage(
        {
          type: "lovableBackendCreateProjectResult",
          requestId,
          result: result || {
            ok: false,
            error: "Backend project creation returned no response",
          },
        },
        window.location.origin,
      );
    },
  );
});

let _lastSecurityFindings = [];

function isLovableOrigin(origin) {
  try {
    const host = new URL(origin).hostname;
    return host === "lovable.dev" || host.endsWith(".lovable.dev");
  } catch (error) {
    return false;
  }
}

function hasExtensionRuntime() {
  try {
    return (
      typeof chrome !== "undefined" &&
      !!chrome.runtime &&
      !!chrome.runtime.id &&
      typeof chrome.runtime.sendMessage === "function"
    );
  } catch (error) {
    return false;
  }
}

async function getStoredLovableTokenAndProject() {
  if (!qlRuntimeAvailable() || typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
    return { token: "", projectId: "" };
  }
  var value247 = await new Promise(function (resolve) {
    try {
      chrome.storage.local.get(
        ["lovable_token", "lovable_projectId"],
        resolve
      );
    } catch (error) {
      if (qlIsIgnoredExtensionError(error)) qlMarkContextDead();
      resolve({});
    }
  });
  var token = value247.lovable_token || "";
  var projectId = value247.lovable_projectId || "";
  if (token.indexOf("Bearer ") === 0) {
    token = token.slice(7);
  }
  if (!token) {
    var value251 = await new Promise(function (resolve) {
      qlSafeRuntimeSendMessage(
        { action: "readCookies" },
        function (response) { resolve(response); }
      );
    });
    if (value251 && value251.success && value251.tokens && value251.tokens.length > 0) {
      token = value251.tokens[0].token;
    }
  }
  return { token, projectId };
}

async function publishProject(input) {
  try {
    const response = await fetch("https://api.lovable.dev/projects/" + input.projectId + "/deployments?async=true", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + input.token
      },
      body: "{}"
    });
    if (!response.ok && response.status !== 202) {
      let messageText = "";
      try {
        messageText = (await response.text()).slice(0, 120);
      } catch (error) {}
      return {
        ok: false,
        status: response.status,
        error: "HTTP " + response.status + (messageText ? ": " + messageText : "")
      };
    }
    const dataValue = await response.json().catch(() => ({}));
    return { ok: true, deployment: dataValue };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

async function getSecurityData(input) {
  try {
    const response = await fetch("https://api.lovable.dev/projects/" + input.projectId + "/security/data", {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + input.token
      }
    });
    if (!response.ok) {
      let messageText = "";
      try {
        messageText = (await response.text()).slice(0, 120);
      } catch (error) {}
      return {
        ok: false,
        status: response.status,
        error: "HTTP " + response.status + (messageText ? ": " + messageText : "")
      };
    }
    const dataValue = await response.json().catch(() => ({}));
    return { ok: true, data: dataValue };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

async function runSecurityScan(input) {
  try {
    const response = await fetch("https://api.lovable.dev/projects/" + input.projectId + "/security-scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + input.token
      },
      body: JSON.stringify({
        scanner_configs: [
          { name: "connector_security_scan" },
          { name: "agent_security" }
        ],
        force: !!input.force
      })
    });
    if (!response.ok) {
      let messageText = "";
      try {
        messageText = (await response.text()).slice(0, 120);
      } catch (error) {}
      return {
        ok: false,
        status: response.status,
        error: "HTTP " + response.status + (messageText ? ": " + messageText : "")
      };
    }
    const dataValue = await response.json().catch(() => ({}));
    return { ok: true, data: dataValue };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

async function fixAllSecurityFindings(input) {
  try {
    const dataValue = Array.isArray(input.findings) ? input.findings : [];
    if (dataValue.length === 0) {
      return { ok: false, error: "no findings to fix" };
    }
    const items = dataValue.map((item) => {
      const asset = {
        id: item.id,
        internal_id: item.internal_id || item.id,
        name: item.name,
        description: item.description,
        level: item.level,
        link: item.link
      };
      if (item.category) asset.category = item.category;
      if (item.details) asset.details = item.details;
      if (item.remediation_difficulty) asset.remediation_difficulty = item.remediation_difficulty;
      if (item.metadata) asset.metadata = item.metadata;
      return {
        scanner_name: item.scanner || "unknown",
        finding: asset
      };
    });
    const backendMessage =
      "Load the security issues from the scan results and fix them. Security scan findings: " +
      JSON.stringify(items) +
      ".";
    const response = await new Promise((resolve) => {
      qlSafeRuntimeSendMessage(
        {
          action: "backendSendPrompt",
          message: backendMessage,
          projectId: input.projectId || "",
        },
        (result) => {
          resolve(result || { ok: false, error: "No backend response" });
        },
      );
    });
    if (!response.ok && !response.accepted) {
      return {
        ok: false,
        status: response.status,
        error: response.error || "Backend chat failed",
      };
    }
    return { ok: true, status: response.status, count: dataValue.length };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}
