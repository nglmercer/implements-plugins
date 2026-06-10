import type { PluginInput } from "./types.ts";
import { validatePlugin } from "./validation.ts";
import { resolve } from "jsr:@std/path";

export async function loadPluginFromFile(
  path: string | URL,
): Promise<PluginInput> {
  const pathStr = path instanceof URL ? path.href : path;
  const mod = await import(pathStr);
  const plugin = mod.default ?? mod.plugin ?? mod;
  validatePlugin(plugin as PluginInput);
  return plugin as PluginInput;
}

export async function loadPluginsFromDir(
  dir: string | URL,
): Promise<PluginInput[]> {
  const dirStr = dir instanceof URL ? dir.href : resolve(dir);
  const plugins: PluginInput[] = [];
  for await (const entry of Deno.readDir(dirStr)) {
    if (!entry.isFile) continue;
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".js")) continue;

    const filePath = `${dirStr}/${entry.name}`;
    const plugin = await loadPluginFromFile(filePath);
    plugins.push(plugin);
  }
  return plugins;
}
