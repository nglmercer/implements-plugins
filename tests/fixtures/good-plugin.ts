import type { IPlugin, PluginContext } from "../../mod.ts";

class FixturePlugin implements IPlugin {
  readonly metadata = { name: "fixture", version: "1.0.0" };
  setup(_ctx: PluginContext) {}
}

export default new FixturePlugin();
