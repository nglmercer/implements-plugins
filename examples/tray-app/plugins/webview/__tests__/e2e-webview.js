// @bun
// webview/__tests__/e2e-webview.ts
import { Application } from "webview-napi";

// webview/protocol.ts
var EVENT_CUSTOM_PREFIX = "tikfinity-";
var SET_UNIQUE_ID = "setUniqueId";
function stringifyEvent(event) {
  return JSON.stringify(event);
}
function parseEvent(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// webview/injection.ts
function buildInjectionScript() {
  return `
    (function () {
        // Debug logging: sends messages back to the parent process via IPC
        window.__tikfinity_log__ = function(level, label, data) {
            try {
                var msg = '[TikFinity:' + level + '] ' + label;
                if (data !== undefined) {
                    msg += ' ' + (typeof data === 'object' ? JSON.stringify(data) : String(data));
                }
                if (window.ipc && window.ipc.postMessage) {
                    window.ipc.postMessage('__TIKFIVITY_LOG__:' + msg);
                }
            } catch(e) {}
        };

        try {
            window.__tikfinity_log__('INFO', 'injection script starting');

            window.TiktokPayload = window.TiktokPayload || "";
            window.pendingEvents = window.pendingEvents || [];

            window.getPayload = function () {
                return window.TiktokPayload;
            };

            window.getPendingEvents = function () {
                const events = window.pendingEvents.slice();
                window.pendingEvents = [];
                return events;
            };

            window.checkForEvents = function () {
                if (window.pendingEvents.length > 0) {
                    return window.pendingEvents.shift();
                }
                return null;
            };

            window.sendToBackend = function(data) {
                window.__tikfinity_log__('INFO', 'sendToBackend called', { dataLen: data ? data.length : 0 });
                window.ipc.postMessage(data);
            };

            window.__webview_on_message__ = function(message) {
                try {
                    const event = JSON.parse(message);
                    window.pendingEvents.push(event);
                    window.dispatchEvent(new MessageEvent('message', {
                        data: event,
                        origin: 'tikfinity-backend',
                        bubbles: true
                    }));
                    if (event.eventName) {
                        window.dispatchEvent(new CustomEvent('${EVENT_CUSTOM_PREFIX}' + event.eventName, {
                            detail: event
                        }));
                    }
                    window.__tikfinity_log__('INFO', 'event received from backend', { eventName: event.eventName });
                } catch (e) {
                    window.__tikfinity_log__('ERROR', 'failed to parse event from backend', { error: e.message, message: message });
                }
            };

            // Intercept WebSocket at the prototype level
            function interceptWebSocketPrototype() {
                if (typeof WebSocket === 'undefined') {
                    return false;
                }
                if (!WebSocket.prototype || !WebSocket.prototype.send) {
                    return false;
                }
                if (WebSocket.prototype.send.__tikfinityIntercepted) {
                    return true;
                }

                try {
                    const originalSend = WebSocket.prototype.send;
                    WebSocket.prototype.send = function (data) {
                        if (typeof data === 'string' && data.includes("${SET_UNIQUE_ID}")) {
                            if (window.TiktokPayload !== data) {
                                window.__tikfinity_log__('INFO', 'prototype interceptor captured payload', { dataLen: data.length });
                                window.TiktokPayload = data;
                                window.ipc.postMessage(data);
                            }
                        }
                        return originalSend.apply(this, arguments);
                    };
                    WebSocket.prototype.send.__tikfinityIntercepted = true;
                    window.__tikfinity_log__('INFO', 'WebSocket prototype interceptor installed');
                    return true;
                } catch(e) {
                    window.__tikfinity_log__('ERROR', 'prototype interceptor failed', { error: e.message });
                    return false;
                }
            }

            // Intercept WebSocket at the constructor level (catches page replacements)
            function interceptWebSocketConstructor() {
                if (typeof WebSocket === 'undefined') {
                    return false;
                }
                if (window.WebSocket.__tikfinityIntercepted) {
                    return true;
                }

                try {
                    var OriginalWebSocket = WebSocket;
                    var wrappedWebSocket = function(url, protocols) {
                        window.__tikfinity_log__('INFO', 'WebSocket constructed', { url: String(url) });
                        var instance = new OriginalWebSocket(url, protocols);

                        // Wrap the instance's send method directly
                        if (instance && instance.send) {
                            var originalInstanceSend = instance.send.bind(instance);
                            instance.send = function(data) {
                                if (typeof data === 'string' && data.includes("${SET_UNIQUE_ID}")) {
                                    if (window.TiktokPayload !== data) {
                                        window.__tikfinity_log__('INFO', 'constructor interceptor captured payload', { dataLen: data.length });
                                        window.TiktokPayload = data;
                                        window.ipc.postMessage(data);
                                    }
                                }
                                return originalInstanceSend(data);
                            };
                        }

                        return instance;
                    };

                    // Copy static properties
                    wrappedWebSocket.prototype = OriginalWebSocket.prototype;
                    wrappedWebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
                    wrappedWebSocket.OPEN = OriginalWebSocket.OPEN;
                    wrappedWebSocket.CLOSING = OriginalWebSocket.CLOSING;
                    wrappedWebSocket.CLOSED = OriginalWebSocket.CLOSED;
                    wrappedWebSocket.__tikfinityIntercepted = true;

                    window.WebSocket = wrappedWebSocket;
                    try { this.WebSocket = wrappedWebSocket; } catch(e) {}

                    window.__tikfinity_log__('INFO', 'WebSocket constructor interceptor installed');
                    return true;
                } catch(e) {
                    window.__tikfinity_log__('ERROR', 'constructor interceptor failed', { error: e.message });
                    return false;
                }
            }

            // Install with retry until both succeed
            var prototypeDone = false;
            var constructorDone = false;

            function installAll() {
                if (!prototypeDone) prototypeDone = interceptWebSocketPrototype();
                if (!constructorDone) constructorDone = interceptWebSocketConstructor();
                if (!prototypeDone || !constructorDone) {
                    setTimeout(installAll, 250);
                }
            }

            installAll();

            window.addEventListener('load', function() {
                prototypeDone = false;
                constructorDone = false;
                installAll();
            });

            window.__tikfinity_log__('INFO', 'injection script completed');
        } catch(e) {
            window.__tikfinity_log__('ERROR', 'injection script crashed', { error: e.message, stack: e.stack });
        }
    })();
  `;
}

// webview/__tests__/e2e-webview.ts
var injectionScript = buildInjectionScript();
var htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TikFinity Test Page</title>
</head>
<body>
  <h1>TikFinity Test Harness</h1>
  <script>
    var wsInstance = null;
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        wsInstance = this;
        var self = this;
        setTimeout(function() {
          self.readyState = 1;
          if (self.onopen) self.onopen();
        }, 100);
      }
      send(data) {
        if (this.onmessage && data.includes('setUniqueId')) {
          var self = this;
          setTimeout(function() {
            self.onmessage({ data: JSON.stringify({ uniqueId: 'test_user_123', sessionId: 'abc' }) });
          }, 50);
        }
      }
      close() {
        this.readyState = 3;
        if (this.onclose) this.onclose();
      }
    }
    window.WebSocket = MockWebSocket;
  </script>
  <script>${injectionScript}</script>
</body>
</html>`;
var results = [];
function assert(name, condition, error) {
  results.push({ name, passed: condition, error });
  if (!condition) {
    console.error(`  FAIL: ${name}${error ? ` - ${error}` : ""}`);
  } else {
    console.log(`  PASS: ${name}`);
  }
}
var ipcState = {
  messages: [],
  evalResolvers: new Map
};
function setupIpcHandler(webview) {
  webview.onIpcMessage((_e, message) => {
    const payload = message.toString();
    if (payload.startsWith("__TIKFIVITY_LOG__:")) {
      const logMsg = payload.replace("__TIKFIVITY_LOG__:", "");
      console.log(`[webview-log] ${logMsg}`);
      return;
    }
    if (payload.startsWith("__EVAL_RESULT__:")) {
      const rest = payload.replace("__EVAL_RESULT__:", "");
      const colonIdx = rest.indexOf(":");
      if (colonIdx !== -1) {
        const requestId = rest.slice(0, colonIdx);
        const result = rest.slice(colonIdx + 1);
        const entry = ipcState.evalResolvers.get(requestId);
        if (entry) {
          clearTimeout(entry.timer);
          ipcState.evalResolvers.delete(requestId);
          if (result.startsWith("ERROR:")) {
            entry.reject(new Error(result.slice(6)));
          } else {
            entry.resolve(result);
          }
        }
      }
      return;
    }
    ipcState.messages.push(payload);
  });
}
function evalScript(webview, js) {
  return new Promise((resolve, reject) => {
    const requestId = "eval_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const timer = setTimeout(() => {
      ipcState.evalResolvers.delete(requestId);
      reject(new Error("eval timed out"));
    }, 5000);
    ipcState.evalResolvers.set(requestId, { resolve, reject, timer });
    const wrappedJs = `
      (function() {
        try {
          var __result = (function() {
            ${js}
          })();
          var __json = JSON.stringify(__result);
          if (__json === undefined) __json = 'null';
          window.ipc.postMessage('__EVAL_RESULT__:${requestId}:' + __json);
        } catch(e) {
          window.ipc.postMessage('__EVAL_RESULT__:${requestId}:ERROR:' + e.message);
        }
      })();
    `;
    webview.evaluateScript(wrappedJs);
  });
}
async function runE2ETests() {
  console.log(`=== TikFinity WebView E2E Tests ===
`);
  const app = new Application;
  const window = app.createBrowserWindow({
    title: "E2E Test - TikFinity WebView"
  });
  const webview = window.createWebview({
    html: htmlContent,
    enableDevtools: false
  });
  setupIpcHandler(webview);
  const poll = () => {
    if (app.runIteration()) {
      window.id;
      webview.id;
      setTimeout(poll, 10);
    }
  };
  poll();
  function sendEventToWebview(eventName, data) {
    const event = stringifyEvent({ eventName, data });
    const script = `
      (function() {
        var event = JSON.parse(${JSON.stringify(event)});
        window.pendingEvents.push(event);
        window.dispatchEvent(new MessageEvent('message', {
          data: event,
          origin: 'tikfinity-backend',
          bubbles: true
        }));
        if (event.eventName) {
          window.dispatchEvent(new CustomEvent('tikfinity-' + event.eventName, {
            detail: event
          }));
        }
      })();
    `;
    webview.evaluateScript(script);
  }
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  console.log(`--- Test Suite ---
`);
  await wait(2000);
  try {
    const raw = await evalScript(webview, `return ({
      hasGetPayload: typeof window.getPayload === 'function',
      hasGetPendingEvents: typeof window.getPendingEvents === 'function',
      hasCheckForEvents: typeof window.checkForEvents === 'function',
      hasSendToBackend: typeof window.sendToBackend === 'function',
      hasOnMessage: typeof window.__webview_on_message__ === 'function'
    });`);
    const state = JSON.parse(raw);
    assert("getPayload is exposed", state.hasGetPayload);
    assert("getPendingEvents is exposed", state.hasGetPendingEvents);
    assert("checkForEvents is exposed", state.hasCheckForEvents);
    assert("sendToBackend is exposed", state.hasSendToBackend);
    assert("__webview_on_message__ is exposed", state.hasOnMessage);
  } catch (e) {
    assert("Injection script loaded", false, e.message);
  }
  await wait(500);
  sendEventToWebview("chat", { comment: "Hello from test!", user: "tester" });
  await wait(300);
  try {
    const raw = await evalScript(webview, `return window.getPendingEvents();`);
    const events = JSON.parse(raw);
    assert("Event received in pendingEvents", events.length > 0, `events: ${raw}`);
    assert("Event has correct eventName", events[0]?.eventName === "chat", `event: ${raw}`);
    assert("Event has correct data", events[0]?.data?.comment === "Hello from test!", `event: ${raw}`);
  } catch (e) {
    assert("Backend -> Webview event communication", false, e.message);
  }
  try {
    await evalScript(webview, `
      var payload = JSON.stringify({
        eventName: 'setUniqueId',
        data: { uniqueId: 'test_user_e2e', sessionId: 'sess_e2e_123' }
      });
      window.sendToBackend(payload);
      return 'sent';
    `);
  } catch (e) {
    assert("WebSocket interceptor payload capture", false, e.message);
  }
  await wait(300);
  assert("IPC message sent for payload", ipcState.messages.some((m) => m.includes("setUniqueId")), `ipcMessages: ${JSON.stringify(ipcState.messages)}`);
  assert("IPC payload contains setUniqueId", ipcState.messages.some((m) => m.includes("setUniqueId")), `ipcMessages: ${JSON.stringify(ipcState.messages)}`);
  try {
    await evalScript(webview, `
      var testEvent = JSON.stringify({ eventName: 'gift', data: { giftId: 123, user: 'donor' } });
      window.__webview_on_message__(testEvent);
      return 'ok';
    `);
    await wait(100);
    const raw = await evalScript(webview, `return window.getPendingEvents();`);
    const events = JSON.parse(raw);
    assert("__webview_on_message__ pushes to pendingEvents", events.length > 0, `events: ${raw}`);
    assert("__webview_on_message__ parses JSON correctly", events[0]?.eventName === "gift", `event: ${raw}`);
  } catch (e) {
    assert("__webview_on_message__ handler", false, e.message);
  }
  try {
    const original = { eventName: "test", data: { nested: { value: 42 } } };
    const stringified = stringifyEvent(original);
    const parsed = parseEvent(stringified);
    assert("stringifyEvent produces valid JSON", typeof stringified === "string");
    assert("parseEvent recovers original data", JSON.stringify(parsed) === JSON.stringify(original));
    assert("parseEvent returns null for invalid JSON", parseEvent("not json") === null);
  } catch (e) {
    assert("Protocol stringify/parse roundtrip", false, e.message);
  }
  try {
    const raw = await evalScript(webview, `return ({ intercepted: WebSocket.prototype.send.__tikfinityIntercepted });`);
    const state = JSON.parse(raw);
    assert("WebSocket interceptor is marked as intercepted", state.intercepted === true);
  } catch (e) {
    assert("WebSocket interceptor idempotency check", false, e.message);
  }
  try {
    const raw = await evalScript(webview, `
      var testPayload = '{"eventName":"setUniqueId","data":{}}';
      WebSocket.prototype.send(testPayload);
      return window.TiktokPayload;
    `);
    assert("SET_UNIQUE_ID constant properly interpolated in interceptor", raw.includes("setUniqueId"), `payload: ${raw}`);
  } catch (e) {
    assert("Constant interpolation check", false, e.message);
  }
  console.log(`
=== Test Summary ===`);
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  if (failed > 0) {
    console.log(`
Failed tests:`);
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }
  app.exit();
  await wait(500);
  process.exit(failed > 0 ? 1 : 0);
}
var globalTimeout = setTimeout(() => {
  console.error(`
!!! TEST SUITE TIMED OUT AFTER 30 SECONDS !!!`);
  process.exit(1);
}, 30000);
runE2ETests().then(() => clearTimeout(globalTimeout)).catch((err) => {
  clearTimeout(globalTimeout);
  console.error("Test suite crashed:", err);
  process.exit(1);
});
