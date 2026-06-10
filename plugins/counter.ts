import type { IPlugin } from "../mod.ts";

class CounterPlugin implements IPlugin {
  readonly metadata = { name: "counter", version: "1.0.0" };
  private count = 0;

  setup() {
    console.log("[counter] setup");
  }

  increment() {
    this.count++;
  }

  getCount() {
    return this.count;
  }
}

const counter = new CounterPlugin();
export default counter;
