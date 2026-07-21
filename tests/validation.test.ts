import { strict as assert } from "node:assert";
import { validatePlugin, PluginValidationError } from "../src/validation.ts";
import type { IPlugin, PluginConst } from "../src/types.ts";

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

await registerTest("validatePlugin - valid class plugin", () => {
  class ValidPlugin implements IPlugin {
    readonly metadata = { name: "valid", version: "1.0.0" };
    setup() {}
  }
  validatePlugin(ValidPlugin);
});

await registerTest("validatePlugin - valid object plugin", () => {
  const plugin: PluginConst = {
    metadata: { name: "valid-obj", version: "1.0.0" },
    setup() {},
  };
  validatePlugin(plugin);
});

await registerTest("validatePlugin - plugin with all hooks", () => {
  class FullPlugin implements IPlugin {
    readonly metadata = { name: "full", version: "1.0.0" };
    setup() {}
    onLoad() {}
    onEnable() {}
    onDisable() {}
    onUnload() {}
  }
  validatePlugin(FullPlugin);
});

await registerTest("validatePlugin - plugin with no hooks", () => {
  const plugin: PluginConst = {
    metadata: { name: "no-hooks", version: "1.0.0" },
  };
  validatePlugin(plugin);
});

await registerTest("validatePlugin - rejects null", () => {
  assert.throws(
    () => validatePlugin(null as unknown as PluginConst),
    /Plugin must be a class instance or a plain object with metadata/,
  );
});

await registerTest("validatePlugin - rejects undefined", () => {
  assert.throws(
    () => validatePlugin(undefined as unknown as PluginConst),
    /Plugin must be a class instance or a plain object with metadata/,
  );
});

await registerTest("validatePlugin - rejects string", () => {
  assert.throws(
    () => validatePlugin("not-a-plugin" as unknown as PluginConst),
    /Plugin must be a class instance or a plain object with metadata/,
  );
});

await registerTest("validatePlugin - rejects number", () => {
  assert.throws(
    () => validatePlugin(42 as unknown as PluginConst),
    /Plugin must be a class instance or a plain object with metadata/,
  );
});

await registerTest("validatePlugin - rejects object without metadata", () => {
  assert.throws(
    () => validatePlugin({ setup() {} } as unknown as PluginConst),
    /Plugin must have a metadata object/,
  );
});

await registerTest("validatePlugin - rejects metadata with empty name", () => {
  assert.throws(
    () =>
      validatePlugin({
        metadata: { name: "", version: "1.0.0" },
      } as unknown as PluginConst),
    /Plugin metadata must have non-empty 'name' and 'version' strings/,
  );
});

await registerTest("validatePlugin - rejects metadata with empty version", () => {
  assert.throws(
    () =>
      validatePlugin({
        metadata: { name: "test", version: "" },
      } as unknown as PluginConst),
    /Plugin metadata must have non-empty 'name' and 'version' strings/,
  );
});

await registerTest("validatePlugin - rejects metadata with missing name", () => {
  assert.throws(
    () =>
      validatePlugin({
        metadata: { version: "1.0.0" },
      } as unknown as PluginConst),
    /Plugin metadata must have non-empty 'name' and 'version' strings/,
  );
});

await registerTest("validatePlugin - rejects metadata with missing version", () => {
  assert.throws(
    () =>
      validatePlugin({
        metadata: { name: "test" },
      } as unknown as PluginConst),
    /Plugin metadata must have non-empty 'name' and 'version' strings/,
  );
});

await registerTest("validatePlugin - rejects hook that is not a function", () => {
  assert.throws(
    () =>
      validatePlugin({
        metadata: { name: "bad-hook", version: "1.0.0" },
        setup: "not-a-function",
      } as unknown as PluginConst),
    /"setup" must be a function/,
  );
});

await registerTest("validatePlugin - rejects onLoad that is not a function", () => {
  assert.throws(
    () =>
      validatePlugin({
        metadata: { name: "bad-onload", version: "1.0.0" },
        onLoad: 123,
      } as unknown as PluginConst),
    /"onLoad" must be a function/,
  );
});

await registerTest("validatePlugin - class plugin without metadata in prototype or instance", () => {
  class BadClassPlugin {
    setup() {}
  }
  assert.throws(
    () => validatePlugin(BadClassPlugin as unknown as PluginConst),
    /Class plugin must have metadata in prototype or instance/,
  );
});

await registerTest("validatePlugin - class plugin with invalid metadata", () => {
  class BadMetaPlugin {
    static metadata = { name: "", version: "1.0.0" };
    setup() {}
  }
  assert.throws(
    () => validatePlugin(BadMetaPlugin),
    /Class plugin must have metadata in prototype or instance/,
  );
});

await registerTest("PluginValidationError has correct name", () => {
  const err = new PluginValidationError("test error");
  assert.deepStrictEqual(err.name, "PluginValidationError");
  assert.deepStrictEqual(err.message, "test error");
});
