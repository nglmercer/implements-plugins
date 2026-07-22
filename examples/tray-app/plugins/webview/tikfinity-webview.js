// @bun
// webview/tikfinity-webview.ts
import { Application } from "webview-napi";

// webview/protocol.ts
var PAYLOAD_PREFIX = "TikFinity_PAYLOAD:";
var EVENT_PREFIX = "TikFinity_EVENT:";
var EVENT_CUSTOM_PREFIX = "tikfinity-";
var SET_UNIQUE_ID = "setUniqueId";
var EXIT_COMMAND = "TikFinity_EXIT";

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

// webview/tikfinity-webview.ts
var TIKFINITY_URL = "https://tikfinity.zerody.one/";
var STARTUP_LOG = "Starting TikFinity webview process...";
var WINDOW_TITLE = "TikTok Login - Synchronizing TikFinity";
var PAYLOAD_LOG_RECEIVED = "Payload received from browser:";
var PAYLOAD_LOG_CREDENTIALS = "Credentials captured successfully";
var PAYLOAD_LOG_LABEL = "PAYLOAD:";
var EVENT_LOG_FORWARD = "Event to forward to webview:";
var EVENT_LOG_STDIN = "stdin error (non-fatal):";
var EVENT_LOG_STDIN_SETUP = "stdin setup error (non-fatal):";
async function startWebview() {
  console.log(STARTUP_LOG);
  const app = new Application;
  const window = app.createBrowserWindow({
    title: WINDOW_TITLE
  });
  const webview = window.createWebview({
    preload: buildInjectionScript(),
    url: TIKFINITY_URL,
    enableDevtools: true
  });
  webview.onIpcMessage((_e, message) => {
    const payload = message.toString();
    if (payload.startsWith("__TIKFIVITY_LOG__:")) {
      const logMsg = payload.replace("__TIKFIVITY_LOG__:", "");
      console.error("[webview]", logMsg);
      return;
    }
    console.log(PAYLOAD_LOG_RECEIVED, payload);
    if (payload.includes(SET_UNIQUE_ID)) {
      console.log(PAYLOAD_LOG_CREDENTIALS);
      console.log(PAYLOAD_LOG_LABEL, payload);
      process.stdout.write(`${PAYLOAD_PREFIX}${payload}
`);
      setTimeout(() => {}, 500);
    } else if (payload.startsWith(EVENT_PREFIX)) {
      const eventData = payload.replace(EVENT_PREFIX, "");
      console.log(EVENT_LOG_FORWARD, eventData);
      webview.evaluateScript(`
        (function() {
            const eventData = JSON.parse(${JSON.stringify(eventData)});
            window.pendingEvents.push(eventData);
            window.dispatchEvent(new MessageEvent('message', {
                data: eventData,
                origin: 'tikfinity-backend'
            }));
        })();
      `);
    }
  });
  app.onEvent((_e, event) => {
    console.log("event", event);
  });
  try {
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      const input = chunk.toString();
      if (input.startsWith(EXIT_COMMAND)) {
        console.log("Received exit command, closing webview...");
        app.exit();
        return;
      }
      if (input.startsWith(EVENT_PREFIX)) {
        const eventData = input.replace(EVENT_PREFIX, "").trim();
        webview.evaluateScript(`
          (function() {
              const event = JSON.parse(${JSON.stringify(eventData)});
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
          })();
        `);
      }
    });
    process.stdin.on("error", (err) => {
      console.log(EVENT_LOG_STDIN, err.message);
    });
  } catch (err) {
    console.log(EVENT_LOG_STDIN_SETUP, err);
  }
  const poll = () => {
    if (app.runIteration()) {
      window.id;
      webview.id;
      setTimeout(poll, 10);
    } else {
      process.exit(0);
    }
  };
  poll();
}
startWebview();
