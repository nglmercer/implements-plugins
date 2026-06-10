import { PluginManager, type IPlugin } from "../mod.ts";

class TimePlugin implements IPlugin {
  readonly metadata = { name: "time", version: "1.0.0" };

  setup() {
    console.log("[time] setup");
  }

  now() {
    return new Date().toISOString();
  }
}

const time = new TimePlugin();
export default time;
