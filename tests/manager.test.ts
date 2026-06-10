import { assertEquals, assertRejects, assertThrows } from "jsr:@std/assert";
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

Deno.test("PluginManager - register class plugin", () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);
  assertEquals(manager.has("test"), true);
});

Deno.test("PluginManager - register object plugin", () => {
  const manager = new PluginManager();
  manager.register(ObjectPlugin);
  assertEquals(manager.has("obj-plugin"), true);
});

Deno.test("PluginManager - register multiple plugins", () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);
  manager.register(MinimalPlugin);
  manager.register(ObjectPlugin);
  assertEquals(manager.getPlugins().length, 3);
});

Deno.test("PluginManager - reject duplicate plugin", () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);
  assertThrows(
    () => manager.register(TestPlugin),
    Error,
    'Plugin "test" is already registered',
  );
});

Deno.test("PluginManager - getPlugin returns plugin", () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);
  const plugin = manager.getPlugin("test");
  assertEquals(plugin, TestPlugin);
});

Deno.test("PluginManager - getPlugin returns undefined for missing", () => {
  const manager = new PluginManager();
  const plugin = manager.getPlugin("nonexistent");
  assertEquals(plugin, undefined);
});

Deno.test("PluginManager - getPlugins returns all names", () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);
  manager.register(MinimalPlugin);
  const names = manager.getPlugins();
  assertEquals(names.includes("test"), true);
  assertEquals(names.includes("minimal"), true);
});

Deno.test("PluginManager - has returns false for missing", () => {
  const manager = new PluginManager();
  assertEquals(manager.has("nonexistent"), false);
});

Deno.test("PluginManager - init calls setup and onLoad", async () => {
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

  assertEquals(callOrder, ["setup", "onLoad"]);
});

Deno.test("PluginManager - init only runs once", async () => {
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

  assertEquals(setupCount, 1);
});

Deno.test("PluginManager - shutdown calls onDisable and onUnload", async () => {
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

  assertEquals(callOrder, ["onDisable", "onUnload"]);
});

Deno.test("PluginManager - shutdown clears plugins", async () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);
  await manager.shutdown();

  assertEquals(manager.getPlugins().length, 0);
  assertEquals(manager.has("test"), false);
});

Deno.test("PluginManager - init and shutdown full lifecycle", async () => {
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

  assertEquals(lifecycle, ["setup", "onLoad", "onDisable", "onUnload"]);
});

Deno.test("PluginManager - multiple plugins init order", async () => {
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

  assertEquals(order.length, 2);
  assertEquals(order[0], "a");
  assertEquals(order[1], "b");
});

Deno.test("PluginManager - async hooks are awaited", async () => {
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

  assertEquals(order, ["setup", "onLoad"]);
});

Deno.test("PluginManager - getPlugin returns raw input", () => {
  const manager = new PluginManager();
  manager.register(TestPlugin);
  const raw = manager.getPlugin("test");
  assertEquals(raw, TestPlugin);
});

Deno.test("PluginManager - register invalid plugin throws", () => {
  const manager = new PluginManager();
  assertThrows(
    () => manager.register(null as unknown as PluginConst),
    Error,
  );
});
