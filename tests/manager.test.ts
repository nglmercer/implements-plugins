import { strict as assert } from "node:assert";
import { PluginManager } from "../src/manager.ts";
import type { IPlugin, PluginConst } from "../src/types.ts";

class TestPlugin implements IPlugin {
  readonly metadata = { name: "test", version: "1.0.0" };
  setup() {}
  onLoad() {}
  onEnable() {}
  onDisable() {}
  onUnload() {}
}

class MinimalPlugin implements IPlugin {
  readonly metadata = { name: "minimal", version: "0.1.0" };
}

const ObjectPlugin: PluginConst = {
  metadata: { name: "obj-plugin", version: "1.0.0" },
  setup() {},
};

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

await registerTest("PluginManager - register class plugin", () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);
  assert.deepStrictEqual(manager.has("test"), true);
});

await registerTest("PluginManager - register object plugin", () => {
  const manager = new PluginManager();
  manager.register(ObjectPlugin);
  assert.deepStrictEqual(manager.has("obj-plugin"), true);
});

await registerTest("PluginManager - register multiple plugins", () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);
  manager.register(MinimalPlugin);
  manager.register(ObjectPlugin);
  assert.deepStrictEqual(manager.getPlugins().length, 3);
});

await registerTest("PluginManager - reject duplicate plugin", () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);
  assert.throws(
    () => manager.register(TestPlugin),
    /Plugin "test" is already registered/,
  );
});

await registerTest("PluginManager - getPlugin returns plugin", () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);
  const plugin = manager.getPlugin("test");
  assert.deepStrictEqual(plugin, TestPlugin);
});

await registerTest("PluginManager - getPlugin returns undefined for missing", () => {
  const manager = new PluginManager();
  const plugin = manager.getPlugin("nonexistent");
  assert.deepStrictEqual(plugin, undefined);
});

await registerTest("PluginManager - getPlugins returns all names", () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);
  manager.register(MinimalPlugin);
  const names = manager.getPlugins();
  assert.deepStrictEqual(names.includes("test"), true);
  assert.deepStrictEqual(names.includes("minimal"), true);
});

await registerTest("PluginManager - has returns false for missing", () => {
  const manager = new PluginManager();
  assert.deepStrictEqual(manager.has("nonexistent"), false);
});

await registerTest("PluginManager - init calls setup and onLoad", async () => {
  const callOrder: string[] = [];

  class OrderPlugin implements IPlugin {
    readonly metadata = { name: "order", version: "1.0.0" };
    setup() {
      callOrder.push("setup");
    }
    onLoad() {
      callOrder.push("onLoad");
    }
  }

  const manager = new PluginManager();
  manager.register(OrderPlugin);
  await manager.init();

  assert.deepStrictEqual(callOrder, ["setup", "onLoad"]);
});

await registerTest("PluginManager - init only runs once", async () => {
  let setupCount = 0;

  class CountPlugin implements IPlugin {
    readonly metadata = { name: "count", version: "1.0.0" };
    setup() {
      setupCount++;
    }
  }

  const manager = new PluginManager();
  manager.register(CountPlugin);
  await manager.init();
  await manager.init();

  assert.deepStrictEqual(setupCount, 1);
});

await registerTest("PluginManager - shutdown calls onDisable and onUnload", async () => {
  const callOrder: string[] = [];

  class ShutdownPlugin implements IPlugin {
    readonly metadata = { name: "shutdown", version: "1.0.0" };
    onDisable() {
      callOrder.push("onDisable");
    }
    onUnload() {
      callOrder.push("onUnload");
    }
  }

  const manager = new PluginManager();
  manager.register(ShutdownPlugin);
  await manager.shutdown();

  assert.deepStrictEqual(callOrder, ["onDisable", "onUnload"]);
});

await registerTest("PluginManager - shutdown clears plugins", async () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);
  await manager.shutdown();

  assert.deepStrictEqual(manager.getPlugins().length, 0);
  assert.deepStrictEqual(manager.has("test"), false);
});

await registerTest("PluginManager - init and shutdown full lifecycle", async () => {
  const lifecycle: string[] = [];

  class LifecyclePlugin implements IPlugin {
    readonly metadata = { name: "lifecycle", version: "1.0.0" };
    setup() {
      lifecycle.push("setup");
    }
    onLoad() {
      lifecycle.push("onLoad");
    }
    onEnable() {
      lifecycle.push("onEnable");
    }
    onDisable() {
      lifecycle.push("onDisable");
    }
    onUnload() {
      lifecycle.push("onUnload");
    }
  }

  const manager = new PluginManager();
  manager.register(LifecyclePlugin);
  await manager.init();
  await manager.shutdown();

  assert.deepStrictEqual(lifecycle, ["setup", "onLoad", "onDisable", "onUnload"]);
});

await registerTest("PluginManager - multiple plugins init order", async () => {
  const order: string[] = [];

  class PluginA implements IPlugin {
    readonly metadata = { name: "a", version: "1.0.0" };
    setup() {
      order.push("a");
    }
  }

  class PluginB implements IPlugin {
    readonly metadata = { name: "b", version: "1.0.0" };
    setup() {
      order.push("b");
    }
  }

  const manager = new PluginManager();
  manager.register(PluginA);
  manager.register(PluginB);
  await manager.init();

  assert.deepStrictEqual(order.length, 2);
  assert.deepStrictEqual(order[0], "a");
  assert.deepStrictEqual(order[1], "b");
});

await registerTest("PluginManager - async hooks are awaited", async () => {
  const order: string[] = [];

  class AsyncPlugin implements IPlugin {
    readonly metadata = { name: "async", version: "1.0.0" };
    async setup() {
      await new Promise((r) => setTimeout(r, 10));
      order.push("setup");
    }
    async onLoad() {
      await new Promise((r) => setTimeout(r, 10));
      order.push("onLoad");
    }
  }

  const manager = new PluginManager();
  manager.register(AsyncPlugin);
  await manager.init();

  assert.deepStrictEqual(order, ["setup", "onLoad"]);
});

await registerTest("PluginManager - getPlugin returns raw input", () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);
  const raw = manager.getPlugin("test");
  assert.deepStrictEqual(raw, TestPlugin);
});

await registerTest("PluginManager - register invalid plugin throws", () => {
  const manager = new PluginManager();
  assert.throws(
    () => manager.register(null as unknown as PluginConst),
    Error,
  );
});
