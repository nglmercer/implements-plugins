import type { IPlugin } from "../../mod.ts";

class AnotherPlugin implements IPlugin {
  readonly metadata = { name: "another", version: "2.0.0" };
  setup() {}
  onLoad() {}
}

export default new AnotherPlugin();
