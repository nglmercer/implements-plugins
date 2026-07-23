import type { PluginInput } from "./types.ts";
import { validatePlugin } from "./validation.ts";
import { pathToFileURL } from "node:url";
import { readdir, readFile, writeFile, rm } from "node:fs/promises";
import { watch, existsSync } from "node:fs";
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

// ---------------------------------------------------------------------------
// File watcher for hot-reload
// ---------------------------------------------------------------------------

export interface PluginWatcher {
  close(): void;
  pause(): void;
  resume(): void;
}

export interface PluginWatchHandlers {
  onAdd?(plugin: PluginInput, fileName: string, pluginName: string): void;
  onChange?(plugin: PluginInput, fileName: string, pluginName: string): void;
  onRemove?(fileName: string, pluginName: string | undefined): void;
  onError?(error: Error, fileName: string): void;
}

function getPluginName(plugin: PluginInput): string | undefined {
  if (typeof plugin === "function") {
    return plugin.prototype?.metadata?.name;
  }
  const meta = (plugin as { metadata?: { name?: string } })?.metadata;
  return typeof meta?.name === "string" && meta.name.length > 0
    ? meta.name
    : undefined;
}

const HOTRELOAD_PREFIX = ".hotreload-";

function isPluginFile(name: string | null): name is string {
  if (!name) return false;
  if (name.startsWith(HOTRELOAD_PREFIX)) return false;
  return DEFAULT_EXTENSIONS.has(path.extname(name));
}

export function watchPluginsFromDir(
  dir: string | URL,
  handlers: PluginWatchHandlers,
  options?: {
    recursive?: boolean;
    signal?: AbortSignal;
    debounce?: number;
  },
): PluginWatcher {
  const dirPath = dir instanceof URL ? dir.pathname : path.resolve(dir);
  const debounceMs = options?.debounce ?? 100;
  const fileNameToPluginName = new Map<string, string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let paused = false;
  let watcher: ReturnType<typeof watch> | null = null;
  let reloadCounter = 0;

  async function loadPlugin(
    fileName: string,
  ): Promise<{ plugin: PluginInput } | { error: Error } | "missing"> {
    const filePath = path.join(dirPath, fileName);
    try {
      const source = await readFile(filePath, "utf-8");
      const uniqueName = `${HOTRELOAD_PREFIX}${reloadCounter++}-${fileName}`;
      const tempPath = path.join(dirPath, uniqueName);
      await writeFile(tempPath, source);
      try {
        const tempUrl = pathToFileURL(tempPath).href;
        const mod = await import(tempUrl);
        const plugin = mod.default ?? mod.plugin ?? mod;
        validatePlugin(plugin as PluginInput);
        return { plugin: plugin as PluginInput };
      } finally {
        await rm(tempPath, { force: true });
      }
    } catch (err) {
      if (existsSync(filePath)) {
        // File exists but failed to load → error
        return { error: err instanceof Error ? err : new Error(String(err)) };
      }
      // File no longer on disk → removed
      return "missing";
    }
  }

  function debounce(key: string, fn: () => void) {
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        fn();
      }, debounceMs),
    );
  }

  function handleEvent(
    eventType: "rename" | "change",
    fileName: string | null,
  ) {
    if (paused || !isPluginFile(fileName)) return;
    const file = fileName;

    debounce(file, async () => {
      const previousName = fileNameToPluginName.get(file);
      const result = await loadPlugin(file);

      if (result === "missing") {
        fileNameToPluginName.delete(file);
        handlers.onRemove?.(file, previousName);
        return;
      }

      if ("error" in result) {
        handlers.onError?.(result.error, file);
        return;
      }

      const plugin = result.plugin;
      const name = getPluginName(plugin);
      if (!name) {
        handlers.onError?.(
          new Error(`Plugin in ${file} has no valid metadata.name`),
          file,
        );
        return;
      }
      fileNameToPluginName.set(file, name);

      if (previousName === undefined) {
        handlers.onAdd?.(plugin, file, name);
      } else {
        handlers.onChange?.(plugin, file, name);
      }
    });
  }

  try {
    watcher = watch(
      dirPath,
      { recursive: options?.recursive },
      (eventType, fileName) => {
        handleEvent(eventType, fileName);
      },
    );
  } catch (err) {
    handlers.onError?.(err as Error, dirPath);
  }

  if (options?.signal) {
    options.signal.addEventListener(
      "abort",
      () => {
        if (watcher) watcher.close();
      },
      { once: true },
    );
  }

  return {
    close() {
      if (watcher) watcher.close();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
  };
}
