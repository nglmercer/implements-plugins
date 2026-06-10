import type { IPlugin } from "../../mod.ts";

class FixturePlugin implements IPlugin {
  readonly metadata = { name: "fixture", version: "1.0.0" };
  setup() {}
}

export default new FixturePlugin();
