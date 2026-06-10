import { PluginManager, loadPluginFromUrl, type PluginInput, type IPlugin } from "../mod.ts";

const SERVER_URL = "http://localhost:8000";

interface PluginInfo {
  name: string;
  has: boolean;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  result?: T;
  count?: number;
  time?: string;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

console.log("=== Plugin System Client Demo ===\n");

console.log("1. Fetching available plugins...");
const { plugins } = await fetchJson<{ plugins: PluginInfo[] }>("/plugins");
console.log("   Available plugins:", plugins.map((p) => p.name).join(", "));

console.log("\n2. Testing counter plugin...");
await postJson("/counter/increment", {});
await postJson("/counter/increment", {});
const counterRes = await fetchJson<ApiResponse<number>>("/counter");
console.log("   Counter value:", counterRes.count);

console.log("\n3. Testing time plugin...");
const timeRes = await fetchJson<ApiResponse<string>>("/time");
console.log("   Current time:", timeRes.time);

console.log("\n4. Testing math plugin via API...");
const addRes = await postJson<ApiResponse<number>>("/math/add", {
  a: 5,
  b: 3,
});
console.log("   5 + 3 =", addRes.result);

const mulRes = await postJson<ApiResponse<number>>("/math/multiply", {
  a: 4,
  b: 7,
});
console.log("   4 * 7 =", mulRes.result);

console.log("\n5. Invoking arbitrary plugin method...");
const invokeRes = await postJson<ApiResponse<string>>(
  "/plugins/time/invoke",
  { method: "now", args: [] },
);
console.log("   time.now():", invokeRes.result);

console.log("\n6. Getting server stats...");
const stats = await fetchJson<{
  plugins: number;
  requests: number;
  uptime: number;
}>("/stats");
console.log("   Loaded plugins:", stats.plugins);
console.log("   Total requests:", stats.requests);
console.log("   Uptime:", Math.round(stats.uptime), "ms");

console.log("\n7. Loading plugin from URL (using loadPluginFromUrl)...");
try {
  const plugin = await loadPluginFromUrl(`${SERVER_URL}/plugins/counter.ts`);
  const pluginWithMeta = plugin as PluginInput & { metadata: { name: string } };
  console.log("   Loaded plugin from URL:", pluginWithMeta.metadata?.name);

  const manager = new PluginManager();
  manager.register(plugin);
  await manager.init();

  const counter = manager.getPlugin("counter") as {
    increment(): void;
    getCount(): number;
  };
  counter?.increment();
  counter?.increment();
  counter?.increment();
  console.log("   Counter from URL plugin:", counter?.getCount());

  await manager.shutdown();
} catch (e) {
  console.log("   Note: URL loading requires the server to serve .ts files");
  console.log("   Error:", e instanceof Error ? e.message : e);
}

console.log("\n=== Demo Complete ===");
