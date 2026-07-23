import { watchPluginsFromDir } from "../src/loader.ts";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { strict as assert } from "node:assert";
import type { PluginInput } from "../src/types.ts";

const PLUGIN_A = `import type { IPlugin } from "../../mod.ts";
class WatcherA implements IPlugin {
  readonly metadata = { name: "watcher-a", version: "1.0.0" };
  setup() {}
}
export default new WatcherA();
`;

const PLUGIN_A_V2 = `import type { IPlugin } from "../../mod.ts";
class WatcherA implements IPlugin {
  readonly metadata = { name: "watcher-a", version: "2.0.0" };
  setup() {}
  onEnable() {}
}
export default new WatcherA();
`;

const PLUGIN_B = `import type { IPlugin } from "../../mod.ts";
class WatcherB implements IPlugin {
  readonly metadata = { name: "watcher-b", version: "1.0.0" };
  setup() {}
}
export default new WatcherB();
`;

const INVALID_PLUGIN = `export default { foo: "bar" };`;

function getMetadata(plugin: PluginInput): { name: string; version: string } {
  if (typeof plugin === "function") {
    return (plugin as { prototype: { metadata: { name: string; version: string } } }).prototype.metadata;
  }
  return (plugin as { metadata: { name: string; version: string } }).metadata;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface WatcherEvent {
  type: "add" | "change" | "remove" | "error";
  fileName?: string;
  pluginName?: string;
  error?: Error;
}

/* async function collectEvents(
  watcher: ReturnType<typeof watchPluginsFromDir>,
  dir: string,
  action: () => Promise<void>,
  timeoutMs = 2000,
): Promise<WatcherEvent[]> {
  const events: WatcherEvent[] = [];

  const originalAdd = watcher.onAdd;
  const originalChange = watcher.onChange;
  const originalRemove = watcher.onRemove;
  const originalError = watcher.onError;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve(events);
    }, timeoutMs);

    // We need to re-create the watcher to inject our collectors
    // Instead, we'll poll — the handlers are set at construction time
    // So we use a different approach: wrap the action + poll

    // Actually we can't re-set handlers, so we'll just run the action
    // and rely on the fact that we can't intercept them here.
    // Instead the individual tests set up their own watchers.

    clearTimeout(timer);
    reject(new Error("Use individual test setup instead"));
  });
} */

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

await registerTest("watchPluginsFromDir - detects new file added", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "plugin-watch-"));
  const events: WatcherEvent[] = [];

  try {
    const watcher = watchPluginsFromDir(dir, {
      onAdd(plugin, fileName, pluginName) {
        events.push({ type: "add", fileName, pluginName });
      },
      onChange(plugin, fileName, pluginName) {
        events.push({ type: "change", fileName, pluginName });
      },
      onRemove(fileName, pluginName) {
        events.push({ type: "remove", fileName, pluginName });
      },
      onError(error, fileName) {
        events.push({ type: "error", fileName, error });
      },
    }, { debounce: 50 });

    // Give watcher time to start
    await delay(100);

    // Add a new plugin file
    await writeFile(path.join(dir, "watcher-a.ts"), PLUGIN_A);

    // Wait for debounce + event propagation
    await delay(300);

    assert.ok(events.length >= 1, "Expected at least one event, got " + events.length);
    const addEvent = events.find((e) => e.type === "add");
    assert.ok(addEvent, "Expected an 'add' event");
    assert.strictEqual(addEvent!.fileName, "watcher-a.ts");
    assert.strictEqual(addEvent!.pluginName, "watcher-a");

    watcher.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await registerTest("watchPluginsFromDir - detects file modification", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "plugin-watch-"));
  const events: WatcherEvent[] = [];

  try {
    const watcher = watchPluginsFromDir(dir, {
      onAdd(plugin, fileName, pluginName) {
        events.push({ type: "add", fileName, pluginName });
      },
      onChange(plugin, fileName, pluginName) {
        events.push({ type: "change", fileName, pluginName });
      },
      onRemove(fileName, pluginName) {
        events.push({ type: "remove", fileName, pluginName });
      },
      onError(error, fileName) {
        events.push({ type: "error", fileName, error });
      },
    }, { debounce: 50 });

    await delay(100);

    // First add the file so the watcher tracks it
    await writeFile(path.join(dir, "watcher-a.ts"), PLUGIN_A);
    await delay(300);

    // Now modify it
    await writeFile(path.join(dir, "watcher-a.ts"), PLUGIN_A_V2);
    await delay(300);

    const changeEvent = events.find((e) => e.type === "change");
    assert.ok(changeEvent, "Expected a 'change' event, got: " + JSON.stringify(events));
    assert.strictEqual(changeEvent!.fileName, "watcher-a.ts");
    assert.strictEqual(changeEvent!.pluginName, "watcher-a");

    watcher.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await registerTest("watchPluginsFromDir - detects file removal", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "plugin-watch-"));
  const events: WatcherEvent[] = [];

  try {
    // Pre-create the file
    const filePath = path.join(dir, "watcher-a.ts");
    await writeFile(filePath, PLUGIN_A);

    const watcher = watchPluginsFromDir(dir, {
      onAdd(plugin, fileName, pluginName) {
        events.push({ type: "add", fileName, pluginName });
      },
      onChange(plugin, fileName, pluginName) {
        events.push({ type: "change", fileName, pluginName });
      },
      onRemove(fileName, pluginName) {
        events.push({ type: "remove", fileName, pluginName });
      },
      onError(error, fileName) {
        events.push({ type: "error", fileName, error });
      },
    }, { debounce: 50 });

    await delay(100);

    // Remove the file
    await rm(filePath);

    await delay(300);

    const removeEvent = events.find((e) => e.type === "remove");
    assert.ok(removeEvent, "Expected a 'remove' event, got: " + JSON.stringify(events));
    assert.strictEqual(removeEvent!.fileName, "watcher-a.ts");

    watcher.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await registerTest("watchPluginsFromDir - ignores non-plugin files", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "plugin-watch-"));
  const events: WatcherEvent[] = [];

  try {
    const watcher = watchPluginsFromDir(dir, {
      onAdd(plugin, fileName, pluginName) {
        events.push({ type: "add", fileName, pluginName });
      },
      onChange(plugin, fileName, pluginName) {
        events.push({ type: "change", fileName, pluginName });
      },
      onRemove(fileName, pluginName) {
        events.push({ type: "remove", fileName, pluginName });
      },
      onError(error, fileName) {
        events.push({ type: "error", fileName, error });
      },
    }, { debounce: 50 });

    await delay(100);

    // Create a file with non-plugin extension
    await writeFile(path.join(dir, "readme.txt"), "hello");
    await writeFile(path.join(dir, "data.json"), "{}");

    await delay(300);

    assert.strictEqual(events.length, 0, "Expected no events for non-plugin files, got: " + JSON.stringify(events));

    watcher.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await registerTest("watchPluginsFromDir - fires onError for invalid plugin", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "plugin-watch-"));
  const events: WatcherEvent[] = [];

  try {
    const watcher = watchPluginsFromDir(dir, {
      onAdd(plugin, fileName, pluginName) {
        events.push({ type: "add", fileName, pluginName });
      },
      onChange(plugin, fileName, pluginName) {
        events.push({ type: "change", fileName, pluginName });
      },
      onRemove(fileName, pluginName) {
        events.push({ type: "remove", fileName, pluginName });
      },
      onError(error, fileName) {
        events.push({ type: "error", fileName, error });
      },
    }, { debounce: 50 });

    await delay(100);

    // Create a .ts file that doesn't export a valid plugin
    await writeFile(path.join(dir, "invalid.ts"), INVALID_PLUGIN);

    await delay(300);

    const errorEvent = events.find((e) => e.type === "error");
    assert.ok(errorEvent, "Expected an 'error' event for invalid plugin, got: " + JSON.stringify(events));
    assert.strictEqual(errorEvent!.fileName, "invalid.ts");

    watcher.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await registerTest("watchPluginsFromDir - close() stops watching", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "plugin-watch-"));
  const events: WatcherEvent[] = [];

  try {
    const watcher = watchPluginsFromDir(dir, {
      onAdd(plugin, fileName, pluginName) {
        events.push({ type: "add", fileName, pluginName });
      },
      onChange(plugin, fileName, pluginName) {
        events.push({ type: "change", fileName, pluginName });
      },
      onRemove(fileName, pluginName) {
        events.push({ type: "remove", fileName, pluginName });
      },
      onError(error, fileName) {
        events.push({ type: "error", fileName, error });
      },
    }, { debounce: 50 });

    await delay(100);

    // Close the watcher
    watcher.close();

    // Create a file after closing
    await writeFile(path.join(dir, "watcher-a.ts"), PLUGIN_A);

    await delay(300);

    assert.strictEqual(events.length, 0, "Expected no events after close(), got: " + JSON.stringify(events));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await registerTest("watchPluginsFromDir - pause() and resume() work correctly", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "plugin-watch-"));
  const events: WatcherEvent[] = [];

  try {
    const watcher = watchPluginsFromDir(dir, {
      onAdd(plugin, fileName, pluginName) {
        events.push({ type: "add", fileName, pluginName });
      },
      onChange(plugin, fileName, pluginName) {
        events.push({ type: "change", fileName, pluginName });
      },
      onRemove(fileName, pluginName) {
        events.push({ type: "remove", fileName, pluginName });
      },
      onError(error, fileName) {
        events.push({ type: "error", fileName, error });
      },
    }, { debounce: 50 });

    await delay(100);

    // Pause the watcher
    watcher.pause();

    await writeFile(path.join(dir, "watcher-a.ts"), PLUGIN_A);
    await delay(300);

    assert.strictEqual(events.length, 0, "Expected no events while paused, got: " + JSON.stringify(events));

    // Resume the watcher
    watcher.resume();

    await writeFile(path.join(dir, "watcher-b.ts"), PLUGIN_B);
    await delay(300);

    const addEvent = events.find((e) => e.type === "add");
    assert.ok(addEvent, "Expected an 'add' event after resume(), got: " + JSON.stringify(events));
    assert.strictEqual(addEvent!.pluginName, "watcher-b");

    watcher.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await registerTest("watchPluginsFromDir - AbortSignal closes watcher", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "plugin-watch-"));
  const events: WatcherEvent[] = [];

  try {
    const controller = new AbortController();
    const watcher = watchPluginsFromDir(dir, {
      onAdd(plugin, fileName, pluginName) {
        events.push({ type: "add", fileName, pluginName });
      },
      onChange(plugin, fileName, pluginName) {
        events.push({ type: "change", fileName, pluginName });
      },
      onRemove(fileName, pluginName) {
        events.push({ type: "remove", fileName, pluginName });
      },
      onError(error, fileName) {
        events.push({ type: "error", fileName, error });
      },
    }, { debounce: 50, signal: controller.signal });

    await delay(100);

    // Abort
    controller.abort();

    await writeFile(path.join(dir, "watcher-a.ts"), PLUGIN_A);
    await delay(300);

    assert.strictEqual(events.length, 0, "Expected no events after abort, got: " + JSON.stringify(events));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
