import { assertEquals, assertRejects } from "@std/assert";
import { loadPluginFromFile, loadPluginsFromDir } from "../src/loader.ts";
import { resolve } from "@std/path";
import type { PluginInput, IPlugin } from "../src/types.ts";

const FIXTURES = resolve(import.meta.dirname!, "fixtures");

function getMetadata(plugin: PluginInput): { name: string; version: string } {
  if (typeof plugin === "function") {
    return (plugin as { prototype: { metadata: { name: string; version: string } } }).prototype.metadata;
  }
  return (plugin as IPlugin).metadata;
}

Deno.test("loadPluginFromFile - loads valid plugin", async () => {
  const plugin = await loadPluginFromFile(`${FIXTURES}/good-plugin.ts`);
  const meta = getMetadata(plugin);
  assertEquals(meta.name, "fixture");
  assertEquals(meta.version, "1.0.0");
});

Deno.test("loadPluginFromFile - loads another valid plugin", async () => {
  const plugin = await loadPluginFromFile(`${FIXTURES}/another-plugin.ts`);
  const meta = getMetadata(plugin);
  assertEquals(meta.name, "another");
  assertEquals(meta.version, "2.0.0");
});

Deno.test("loadPluginFromFile - rejects invalid plugin", async () => {
  await assertRejects(
    () => loadPluginFromFile(`${FIXTURES}/bad-plugin.ts`),
    Error,
  );
});

Deno.test("loadPluginFromFile - rejects non-existent file", async () => {
  await assertRejects(
    () => loadPluginFromFile(`${FIXTURES}/does-not-exist.ts`),
    Error,
  );
});

Deno.test("loadPluginFromFile - accepts URL", async () => {
  const url = new URL(`file://${FIXTURES}/good-plugin.ts`);
  const plugin = await loadPluginFromFile(url);
  const meta = getMetadata(plugin);
  assertEquals(meta.name, "fixture");
});

Deno.test("loadPluginsFromDir - loads all plugins from directory", async () => {
  const plugins = await loadPluginsFromDir(FIXTURES);
  const names = plugins.map((p) => getMetadata(p).name);
  assertEquals(names.includes("fixture"), true);
  assertEquals(names.includes("another"), true);
});

Deno.test("loadPluginsFromDir - excludes invalid plugins", async () => {
  const plugins = await loadPluginsFromDir(FIXTURES);
  for (const plugin of plugins) {
    const meta = getMetadata(plugin);
    assertEquals(typeof meta.name, "string");
    assertEquals(meta.name.length > 0, true);
  }
});

Deno.test("loadPluginsFromDir - rejects non-existent directory", async () => {
  await assertRejects(
    () => loadPluginsFromDir(`${FIXTURES}/no-dir`),
    Error,
  );
});

Deno.test("loadPluginsFromDir - accepts URL", async () => {
  const url = new URL(`file://${FIXTURES}`);
  const plugins = await loadPluginsFromDir(url);
  assertEquals(plugins.length >= 2, true);
});
