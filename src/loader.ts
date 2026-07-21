import type { PluginInput } from "./types.ts";
import { validatePlugin } from "./validation.ts";
import { pathToFileURL } from "node:url";
import { readdir } from "node:fs/promises";
import path from "node:path";

export interface PluginManifest {
  plugins: Array<{
    path?: string;
    url?: string;
  }>;
}

const DEFAULT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

function normalizeInput(input: string | URL): string {
  if (input instanceof URL) {
    return input.href;
  }
  return input;
}

export async function loadPluginFromFile(
  input: string | URL,
): Promise<PluginInput> {
  const mod = await import(normalizeInput(input));
  const plugin = mod.default ?? mod.plugin ?? mod;
  validatePlugin(plugin as PluginInput);
  return plugin as PluginInput;
}

export async function loadPluginFromUrl(
  url: string | URL,
): Promise<PluginInput> {
  const urlStr = url instanceof URL ? url.href : url;
  const mod = await import(urlStr);
  const plugin = mod.default ?? mod.plugin ?? mod;
  validatePlugin(plugin as PluginInput);
  return plugin as PluginInput;
}

export async function loadPluginsFromDir(
  dir: string | URL,
): Promise<PluginInput[]> {
  const dirPath = dir instanceof URL ? dir.pathname : path.resolve(dir);
  const plugins: PluginInput[] = [];

  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    if (!DEFAULT_EXTENSIONS.has(ext)) continue;

    const filePath = path.join(dirPath, entry.name);
    const fileUrl = pathToFileURL(filePath).href;
    try {
      const plugin = await loadPluginFromFile(fileUrl);
      plugins.push(plugin);
    } catch {
      // skip invalid plugins
    }
  }

  return plugins;
}

export async function loadPluginsFromManifest(
  manifest: PluginManifest,
  baseDir?: string,
): Promise<PluginInput[]> {
  const plugins: PluginInput[] = [];
  for (const entry of manifest.plugins) {
    try {
      if (entry.url) {
        plugins.push(await loadPluginFromUrl(entry.url));
      } else if (entry.path) {
        const resolved = baseDir
          ? path.resolve(baseDir, entry.path)
          : path.resolve(entry.path);
        const fileUrl = pathToFileURL(resolved).href;
        plugins.push(await loadPluginFromFile(fileUrl));
      }
    } catch {
      // skip invalid plugins
    }
  }
  return plugins;
}
