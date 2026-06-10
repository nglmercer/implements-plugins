import { assertEquals, assertThrows } from "@std/assert";
import { validatePlugin, PluginValidationError } from "../src/validation.ts";
import type { IPlugin, PluginConst } from "../src/types.ts";

Deno.test("validatePlugin - valid class plugin", () => {
  class ValidPlugin implements IPlugin {
    readonly metadata = { name: "valid", version: "1.0.0" };
    setup() {}
  }
  validatePlugin(ValidPlugin);
});

Deno.test("validatePlugin - valid object plugin", () => {
  const plugin: PluginConst = {
    metadata: { name: "valid-obj", version: "1.0.0" },
    setup() {},
  };
  validatePlugin(plugin);
});

Deno.test("validatePlugin - plugin with all hooks", () => {
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

Deno.test("validatePlugin - plugin with no hooks", () => {
  const plugin: PluginConst = {
    metadata: { name: "no-hooks", version: "1.0.0" },
  };
  validatePlugin(plugin);
});

Deno.test("validatePlugin - rejects null", () => {
  assertThrows(
    () => validatePlugin(null as unknown as PluginConst),
    PluginValidationError,
    "Plugin must be a class instance or a plain object with metadata",
  );
});

Deno.test("validatePlugin - rejects undefined", () => {
  assertThrows(
    () => validatePlugin(undefined as unknown as PluginConst),
    PluginValidationError,
    "Plugin must be a class instance or a plain object with metadata",
  );
});

Deno.test("validatePlugin - rejects string", () => {
  assertThrows(
    () => validatePlugin("not-a-plugin" as unknown as PluginConst),
    PluginValidationError,
    "Plugin must be a class instance or a plain object with metadata",
  );
});

Deno.test("validatePlugin - rejects number", () => {
  assertThrows(
    () => validatePlugin(42 as unknown as PluginConst),
    PluginValidationError,
    "Plugin must be a class instance or a plain object with metadata",
  );
});

Deno.test("validatePlugin - rejects object without metadata", () => {
  assertThrows(
    () => validatePlugin({ setup() {} } as unknown as PluginConst),
    PluginValidationError,
    "Plugin must have a metadata object",
  );
});

Deno.test("validatePlugin - rejects metadata with empty name", () => {
  assertThrows(
    () =>
      validatePlugin({
        metadata: { name: "", version: "1.0.0" },
      } as unknown as PluginConst),
    PluginValidationError,
    "Plugin metadata must have non-empty 'name' and 'version' strings",
  );
});

Deno.test("validatePlugin - rejects metadata with empty version", () => {
  assertThrows(
    () =>
      validatePlugin({
        metadata: { name: "test", version: "" },
      } as unknown as PluginConst),
    PluginValidationError,
    "Plugin metadata must have non-empty 'name' and 'version' strings",
  );
});

Deno.test("validatePlugin - rejects metadata with missing name", () => {
  assertThrows(
    () =>
      validatePlugin({
        metadata: { version: "1.0.0" },
      } as unknown as PluginConst),
    PluginValidationError,
    "Plugin metadata must have non-empty 'name' and 'version' strings",
  );
});

Deno.test("validatePlugin - rejects metadata with missing version", () => {
  assertThrows(
    () =>
      validatePlugin({
        metadata: { name: "test" },
      } as unknown as PluginConst),
    PluginValidationError,
    "Plugin metadata must have non-empty 'name' and 'version' strings",
  );
});

Deno.test("validatePlugin - rejects hook that is not a function", () => {
  assertThrows(
    () =>
      validatePlugin({
        metadata: { name: "bad-hook", version: "1.0.0" },
        setup: "not-a-function",
      } as unknown as PluginConst),
    PluginValidationError,
    '"setup" must be a function',
  );
});

Deno.test("validatePlugin - rejects onLoad that is not a function", () => {
  assertThrows(
    () =>
      validatePlugin({
        metadata: { name: "bad-onload", version: "1.0.0" },
        onLoad: 123,
      } as unknown as PluginConst),
    PluginValidationError,
    '"onLoad" must be a function',
  );
});

Deno.test("validatePlugin - class plugin without metadata in prototype or instance", () => {
  class BadClassPlugin {
    setup() {}
  }
  assertThrows(
    () => validatePlugin(BadClassPlugin as unknown as PluginConst),
    PluginValidationError,
    "Class plugin must have metadata in prototype or instance",
  );
});

Deno.test("validatePlugin - class plugin with invalid metadata", () => {
  class BadMetaPlugin {
    static metadata = { name: "", version: "1.0.0" };
    setup() {}
  }
  assertThrows(
    () => validatePlugin(BadMetaPlugin),
    PluginValidationError,
  );
});

Deno.test("PluginValidationError has correct name", () => {
  const err = new PluginValidationError("test error");
  assertEquals(err.name, "PluginValidationError");
  assertEquals(err.message, "test error");
});
