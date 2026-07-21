import { loadPluginFromFile, loadPluginsFromDir, loadPluginsFromManifest } from "../src/loader.ts";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { strict as assert } from "node:assert";
import type { PluginInput, IPlugin } from "../src/types.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES = path.resolve(__dirname, "fixtures");

function getMetadata(plugin: PluginInput): { name: string; version: string } {
  if (typeof plugin === "function") {
    return (plugin as { prototype: { metadata: { name: string; version: string } } }).prototype.metadata;
  }
  return (plugin as IPlugin).metadata;
}

const eq = (actual: unknown, expected: unknown) => assert.deepStrictEqual(actual, expected);
const assertsRejects = (fn: () => Promise<unknown>) => assert.rejects(fn);

async function registerTest(name: string, fn: () => void | Promise<void>) {
  if (typeof Deno !== "undefined" && typeof Deno.test === "function") {
    Deno.test(name, fn);
  } else {
    const nodeTestModule = globalThis as any;
    if (!nodeTestModule.__testModule) {
      const mod = await import("node:test");
      nodeTestModule.__testModule = mod;
    }
    nodeTestModule.__testModule.test(name, fn);
  }
}

await registerTest("loadPluginFromFile - loads valid plugin", async () => {
  const plugin = await loadPluginFromFile(path.join(FIXTURES, "good-plugin.ts"));
  const meta = getMetadata(plugin);
  eq(meta.name, "fixture");
  eq(meta.version, "1.0.0");
});

await registerTest("loadPluginFromFile - loads another valid plugin", async () => {
  const plugin = await loadPluginFromFile(path.join(FIXTURES, "another-plugin.ts"));
  const meta = getMetadata(plugin);
  eq(meta.name, "another");
  eq(meta.version, "2.0.0");
});

await registerTest("loadPluginFromFile - rejects invalid plugin", async () => {
  await assertsRejects(() => loadPluginFromFile(path.join(FIXTURES, "bad-plugin.ts")));
});

await registerTest("loadPluginFromFile - rejects non-existent file", async () => {
  await assertsRejects(() => loadPluginFromFile(path.join(FIXTURES, "does-not-exist.ts")));
});

await registerTest("loadPluginFromFile - accepts URL", async () => {
  const url = new URL(`file://${FIXTURES}/good-plugin.ts`);
  const plugin = await loadPluginFromFile(url);
  const meta = getMetadata(plugin);
  eq(meta.name, "fixture");
});

await registerTest("loadPluginsFromDir - loads all plugins from directory", async () => {
  const plugins = await loadPluginsFromDir(FIXTURES);
  const names = plugins.map((p) => getMetadata(p).name);
  eq(names.includes("fixture"), true);
  eq(names.includes("another"), true);
});

await registerTest("loadPluginsFromDir - excludes invalid plugins", async () => {
  const plugins = await loadPluginsFromDir(FIXTURES);
  for (const plugin of plugins) {
    const meta = getMetadata(plugin);
    eq(typeof meta.name, "string");
    eq(meta.name.length > 0, true);
  }
});

await registerTest("loadPluginsFromDir - rejects non-existent directory", async () => {
  await assertsRejects(() => loadPluginsFromDir(path.join(FIXTURES, "no-dir")));
});

await registerTest("loadPluginsFromDir - accepts URL", async () => {
  const url = new URL(`file://${FIXTURES}`);
  const plugins = await loadPluginsFromDir(url);
  eq(plugins.length >= 2, true);
});

await registerTest("loadPluginsFromManifest - loads plugins by path", async () => {
  const manifest = {
    plugins: [{ path: path.join(FIXTURES, "good-plugin.ts") }],
  };
  const plugins = await loadPluginsFromManifest(manifest);
  eq(plugins.length, 1);
  eq(getMetadata(plugins[0]).name, "fixture");
});

await registerTest("loadPluginsFromManifest - loads plugins by relative path with baseDir", async () => {
  const manifest = {
    plugins: [{ path: "fixtures/good-plugin.ts" }],
  };
  const plugins = await loadPluginsFromManifest(manifest, __dirname);
  eq(plugins.length, 1);
  eq(getMetadata(plugins[0]).name, "fixture");
});
