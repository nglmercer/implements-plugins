import type { IPlugin, PluginContext } from "../../../mod.ts";
import type { EventBusPluginType } from "./event-bus.ts";
import type { StoragePluginType } from "./storage.ts";

class ClockPlugin implements IPlugin {
  readonly metadata = {
    name: "clock",
    version: "1.0.0",
    emits: ["system:tick"] as const,
    listens: [] as const,
  };

  private timer: ReturnType<typeof setInterval> | null = null;
  private tickCount = 0;

  setup(ctx: PluginContext): void {
    const storage = ctx.getPlugin<StoragePluginType>("storage");
    const saved = storage?.get<number>("tickCount");
    if (saved !== undefined) {
      this.tickCount = saved;
    }
  }

  onEnable(ctx: PluginContext): void {
    const bus = ctx.getPlugin<EventBusPluginType>("event-bus");
    this.timer = setInterval(() => {
      this.tickCount++;
      bus?.emit("system", "tick", { count: this.tickCount });
    }, 1000);
  }

  onDisable(_ctx: PluginContext): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  onUnload(ctx: PluginContext): void {
    const storage = ctx.getPlugin<StoragePluginType>("storage");
    storage?.set("tickCount", this.tickCount);
  }
}

const clock = new ClockPlugin();
export default clock;
