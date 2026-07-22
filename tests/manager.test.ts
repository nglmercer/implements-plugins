import { strict as assert } from "node:assert";
import { PluginManager } from "../src/manager.ts";
import type { IPlugin, PluginContext, PluginConst } from "../src/types.ts";

class TestPlugin implements IPlugin {
  readonly metadata = { name: "test", version: "1.0.0" };
  setup(_ctx: PluginContext) {}
  onLoad(_ctx: PluginContext) {}
  onEnable(_ctx: PluginContext) {}
  onDisable(_ctx: PluginContext) {}
  onUnload(_ctx: PluginContext) {}
}

class MinimalPlugin implements IPlugin {
  readonly metadata = { name: "minimal", version: "0.1.0" };
}

const ObjectPlugin: PluginConst = {
  metadata: { name: "obj-plugin", version: "1.0.0" },
  setup(_ctx: PluginContext) {},
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

await registerTest("PluginManager - getPlugin returns plugin when enabled", () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);
  manager.enable("test");
  const plugin = manager.getPlugin<IPlugin>("test");
  assert.notDeepStrictEqual(plugin, undefined);
  assert.deepStrictEqual(plugin?.metadata, { name: "test", version: "1.0.0" });
});

await registerTest("PluginManager - getPlugin returns undefined when disabled", () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);
  const plugin = manager.getPlugin("test");
  assert.deepStrictEqual(plugin, undefined);
});

await registerTest("PluginManager - getPluginRaw returns plugin regardless of state", () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);
  const raw = manager.getPluginRaw("test");
  assert.deepStrictEqual(raw, TestPlugin);
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

await registerTest("PluginManager - init calls setup and onLoad with ctx", async () => {
  const callOrder: string[] = [];
  let receivedCtx: PluginContext | undefined;

  class OrderPlugin implements IPlugin {
    readonly metadata = { name: "order", version: "1.0.0" };
    setup(ctx: PluginContext) {
      callOrder.push("setup");
      receivedCtx = ctx;
    }
    onLoad(_ctx: PluginContext) {
      callOrder.push("onLoad");
    }
  }

  const manager = new PluginManager();
  manager.register(OrderPlugin);
  await manager.init();

  assert.deepStrictEqual(callOrder, ["setup", "onLoad"]);
  assert.notDeepStrictEqual(receivedCtx, undefined);
  assert.deepStrictEqual(typeof receivedCtx?.getPlugin, "function");
  assert.deepStrictEqual(typeof receivedCtx?.getPlugins, "function");
});

await registerTest("PluginManager - init only runs once", async () => {
  let setupCount = 0;

  class CountPlugin implements IPlugin {
    readonly metadata = { name: "count", version: "1.0.0" };
    setup(_ctx: PluginContext) {
      setupCount++;
    }
  }

  const manager = new PluginManager();
  manager.register(CountPlugin);
  await manager.init();
  await manager.init();

  assert.deepStrictEqual(setupCount, 1);
});

await registerTest("PluginManager - shutdown calls onDisable and onUnload with ctx", async () => {
  const callOrder: string[] = [];
  let disableCtx: PluginContext | undefined;

  class ShutdownPlugin implements IPlugin {
    readonly metadata = { name: "shutdown", version: "1.0.0" };
    onDisable(ctx: PluginContext) {
      callOrder.push("onDisable");
      disableCtx = ctx;
    }
    onUnload(_ctx: PluginContext) {
      callOrder.push("onUnload");
    }
  }

  const manager = new PluginManager();
  manager.register(ShutdownPlugin);
  await manager.init();
  await manager.shutdown();

  assert.deepStrictEqual(callOrder, ["onDisable", "onUnload"]);
  assert.notDeepStrictEqual(disableCtx, undefined);
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
    setup(_ctx: PluginContext) {
      lifecycle.push("setup");
    }
    onLoad(_ctx: PluginContext) {
      lifecycle.push("onLoad");
    }
    onEnable(_ctx: PluginContext) {
      lifecycle.push("onEnable");
    }
    onDisable(_ctx: PluginContext) {
      lifecycle.push("onDisable");
    }
    onUnload(_ctx: PluginContext) {
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
    setup(_ctx: PluginContext) {
      order.push("a");
    }
  }

  class PluginB implements IPlugin {
    readonly metadata = { name: "b", version: "1.0.0" };
    setup(_ctx: PluginContext) {
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
    async setup(_ctx: PluginContext) {
      await new Promise((r) => setTimeout(r, 10));
      order.push("setup");
    }
    async onLoad(_ctx: PluginContext) {
      await new Promise((r) => setTimeout(r, 10));
      order.push("onLoad");
    }
  }

  const manager = new PluginManager();
  manager.register(AsyncPlugin);
  await manager.init();

  assert.deepStrictEqual(order, ["setup", "onLoad"]);
});

await registerTest("PluginManager - getPlugin returns normalized instance after enable", () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);
  manager.enable("test");
  const plugin = manager.getPlugin<IPlugin>("test");
  assert.notDeepStrictEqual(plugin, undefined);
  assert.deepStrictEqual(plugin?.metadata, { name: "test", version: "1.0.0" });
});

await registerTest("PluginManager - register invalid plugin throws", () => {
  const manager = new PluginManager();
  assert.throws(
    () => manager.register(null as unknown as PluginConst),
    Error,
  );
});

await registerTest("PluginManager - enable fires setup, onLoad, onEnable", async () => {
  const callOrder: string[] = [];

  class EnablePlugin implements IPlugin {
    readonly metadata = { name: "enable-test", version: "1.0.0" };
    setup(_ctx: PluginContext) { callOrder.push("setup"); }
    onLoad(_ctx: PluginContext) { callOrder.push("onLoad"); }
    onEnable(_ctx: PluginContext) { callOrder.push("onEnable"); }
  }

  const manager = new PluginManager();
  manager.register(EnablePlugin);
  manager.enable("enable-test");

  assert.deepStrictEqual(callOrder, ["setup", "onLoad", "onEnable"]);
  assert.deepStrictEqual(manager.getState("enable-test"), "enabled");
});

await registerTest("PluginManager - disable fires onDisable and onUnload", async () => {
  const callOrder: string[] = [];

  class DisablePlugin implements IPlugin {
    readonly metadata = { name: "disable-test", version: "1.0.0" };
    onDisable(_ctx: PluginContext) { callOrder.push("onDisable"); }
    onUnload(_ctx: PluginContext) { callOrder.push("onUnload"); }
  }

  const manager = new PluginManager();
  manager.register(DisablePlugin);
  manager.enable("disable-test");
  manager.disable("disable-test");

  assert.deepStrictEqual(callOrder, ["onDisable", "onUnload"]);
  assert.deepStrictEqual(manager.getState("disable-test"), "disabled");
});

await registerTest("PluginManager - unregister removes plugin", () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);
  manager.unregister("test");

  assert.deepStrictEqual(manager.has("test"), false);
  assert.deepStrictEqual(manager.getPlugins().length, 0);
});

await registerTest("PluginManager - unregister fires onDisable and onUnload for enabled plugin", () => {
  const callOrder: string[] = [];

  class UnregPlugin implements IPlugin {
    readonly metadata = { name: "unreg", version: "1.0.0" };
    onDisable(_ctx: PluginContext) { callOrder.push("onDisable"); }
    onUnload(_ctx: PluginContext) { callOrder.push("onUnload"); }
  }

  const manager = new PluginManager();
  manager.register(UnregPlugin);
  manager.enable("unreg");
  manager.unregister("unreg");

  assert.deepStrictEqual(callOrder, ["onDisable", "onUnload"]);
});

await registerTest("PluginManager - getEnabledPlugins returns only enabled", () => {
  class PluginA implements IPlugin {
    readonly metadata = { name: "a", version: "1.0.0" };
  }
  class PluginB implements IPlugin {
    readonly metadata = { name: "b", version: "1.0.0" };
  }

  const manager = new PluginManager();
  manager.register(PluginA);
  manager.register(PluginB);
  manager.enable("a");

  assert.deepStrictEqual(manager.getEnabledPlugins(), ["a"]);
  assert.deepStrictEqual(manager.getDisabledPlugins(), ["b"]);
});

await registerTest("PluginManager - loadPlugin registers and enables", () => {
  const manager = new PluginManager();
  manager.loadPlugin(TestPlugin);

  assert.deepStrictEqual(manager.has("test"), true);
  assert.deepStrictEqual(manager.getState("test"), "enabled");
  assert.notDeepStrictEqual(manager.getPlugin("test"), undefined);
});

await registerTest("PluginManager - getPlugin returns undefined for disabled plugin", () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);

  assert.deepStrictEqual(manager.getPlugin("test"), undefined);
  assert.deepStrictEqual(manager.getState("test"), "disabled");
});

await registerTest("PluginManager - init enables all registered plugins", async () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);
  manager.register(MinimalPlugin);
  await manager.init();

  assert.deepStrictEqual(manager.getState("test"), "enabled");
  assert.deepStrictEqual(manager.getState("minimal"), "enabled");
  assert.deepStrictEqual(manager.getEnabledPlugins().length, 2);
});

await registerTest("PluginManager - register with path stores path", () => {
  const manager = new PluginManager();
  manager.register(TestPlugin, "./custom/path.ts");

  assert.deepStrictEqual(manager.getPath("test"), "./custom/path.ts");
});
