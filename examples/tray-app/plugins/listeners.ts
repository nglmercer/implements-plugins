import type { IPlugin, PluginContext } from "../../../mod.ts";
import type { EventBusPluginType } from "./event-bus.ts";
//import type { StoragePluginType } from "./storage.ts";
class eventlisteners implements IPlugin {
  readonly metadata = {
    name: "listeners",
    version: "1.0.0",
    emits: ["system"] as const,
    listens: ["tiktok"] as const,
  };

  setup(_ctx: PluginContext): void {

  }

  onEnable(ctx: PluginContext): void {
    const bus = ctx.getPlugin<EventBusPluginType>("event-bus");
    if (bus) {
      bus.onPlatform("tiktok", (e) => {
        if (e.eventName === "chat") {
          console.log(e);

        }
      })
    }
  }

  onDisable(_ctx: PluginContext): void {
  }

  onUnload(_ctx: PluginContext): void {

  }
}

const listeners = new eventlisteners();
export default listeners;
