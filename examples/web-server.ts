import { PluginManager, loadPluginsFromDir, type IPlugin } from "../mod.ts";

const PORT = 8000;

class ApiPlugin implements IPlugin {
  readonly metadata = { name: "api", version: "1.0.0" };
  private requests = 0;

  setup() {
    console.log("[api] plugin setup");
  }

  onRequest(path: string) {
    this.requests++;
    console.log(`[api] request #${this.requests}: ${path}`);
  }

  getRequestCount() {
    return this.requests;
  }
}

class MathPlugin implements IPlugin {
  readonly metadata = { name: "math", version: "1.0.0" };

  setup() {
    console.log("[math] plugin setup");
  }

  add(a: number, b: number) {
    return a + b;
  }

  multiply(a: number, b: number) {
    return a * b;
  }
}

const manager = new PluginManager();
manager.register(new ApiPlugin());
manager.register(new MathPlugin());

const plugins = await loadPluginsFromDir("./plugins");
for (const plugin of plugins) {
  manager.register(plugin);
}

await manager.init();

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

const router = {
  "GET /": () => jsonResponse({
    message: "Deno Plugin System API",
    endpoints: [
      "GET /plugins - List all plugins",
      "GET /plugins/:name - Get plugin info",
      "POST /plugins/:name/invoke - Invoke plugin method",
      "GET /counter - Get counter value",
      "POST /counter/increment - Increment counter",
      "GET /time - Get current time",
      "POST /math/add - Add numbers",
      "POST /math/multiply - Multiply numbers",
      "GET /stats - Get server stats",
    ],
  }),

  "GET /plugins": () => jsonResponse({
    plugins: manager.getPlugins().map((name) => ({
      name,
      has: manager.has(name),
    })),
  }),

  "GET /plugins/:name": (params: Record<string, string>) => {
    const plugin = manager.getPlugin(params.name);
    if (!plugin) return errorResponse("Plugin not found", 404);
    return jsonResponse({ plugin: params.name, exists: true });
  },

  "POST /plugins/:name/invoke": async (
    params: Record<string, string>,
    body: Record<string, unknown>,
  ) => {
    const plugin = manager.getPlugin(params.name) as Record<string, unknown>;
    if (!plugin) return errorResponse("Plugin not found", 404);

    const { method, args = [] } = body;
    if (typeof method !== "string") {
      return errorResponse("method is required");
    }

    const fn = plugin[method];
    if (typeof fn !== "function") {
      return errorResponse(`Method ${method} not found`);
    }

    try {
      const result = await fn(...(args as unknown[]));
      return jsonResponse({ result });
    } catch (e) {
      return errorResponse(String(e), 500);
    }
  },

  "GET /counter": () => {
    const counter = manager.getPlugin("counter") as {
      getCount(): number;
    };
    return jsonResponse({ count: counter?.getCount() ?? 0 });
  },

  "POST /counter/increment": () => {
    const counter = manager.getPlugin("counter") as {
      increment(): void;
      getCount(): number;
    };
    counter?.increment();
    return jsonResponse({ count: counter?.getCount() ?? 0 });
  },

  "GET /time": () => {
    const time = manager.getPlugin("time") as { now(): string };
    return jsonResponse({ time: time?.now() });
  },

  "POST /math/add": (_params: Record<string, string>, body: Record<string, unknown>) => {
    const math = manager.getPlugin("math") as { add(a: number, b: number): number };
    const { a = 0, b = 0 } = body;
    return jsonResponse({ result: math?.add(a as number, b as number) });
  },

  "POST /math/multiply": (_params: Record<string, string>, body: Record<string, unknown>) => {
    const math = manager.getPlugin("math") as { multiply(a: number, b: number): number };
    const { a = 1, b = 1 } = body;
    return jsonResponse({ result: math?.multiply(a as number, b as number) });
  },

  "GET /stats": () => {
    const api = manager.getPlugin("api") as { getRequestCount(): number };
    return jsonResponse({
      plugins: manager.getPlugins().length,
      requests: api?.getRequestCount() ?? 0,
      uptime: performance.now(),
    });
  },
};

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  const api = manager.getPlugin("api") as { onRequest(path: string): void };
  api?.onRequest(path);

  const routeKey = `${method} ${path}`;
  const handler = (router as Record<string, unknown>)[routeKey] as (
    params: Record<string, string>,
    body: Record<string, unknown>,
  ) => Response | Promise<Response>;

  if (handler) {
    const body = method === "POST" ? await req.json() : {};
    return handler({}, body);
  }

  for (const [pattern, handlerFn] of Object.entries(router)) {
    const [routeMethod, routePath] = pattern.split(" ");
    if (routeMethod !== method) continue;

    const paramMatch = routePath.match(/:(\w+)/g);
    if (!paramMatch) continue;

    let routeRegex = routePath.replace(/:(\w+)/g, "(?<$1>[^/]+)");
    routeRegex = `^${routeRegex}$`;

    const match = path.match(new RegExp(routeRegex));
    if (match) {
      const params = match.groups || {};
      const body = method === "POST" ? await req.json() : {};
      return handlerFn(params, body);
    }
  }

  return errorResponse("Not found", 404);
}

console.log(`Plugin server running at http://localhost:${PORT}`);
console.log(`Loaded plugins: ${manager.getPlugins().join(", ")}`);

Deno.serve({ port: PORT }, handleRequest);
