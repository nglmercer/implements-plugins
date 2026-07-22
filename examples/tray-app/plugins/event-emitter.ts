import type { IPlugin, PluginContext } from "../../../mod.ts";

export interface EventEmitterPluginType {
  metadata: { name: string; version: string };
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
  once(event: string, handler: (...args: unknown[]) => void): void;
  listenerCount(event: string): number;
}

type EventHandler = (...args: unknown[]) => void;

class EventEmitterPlugin implements IPlugin {
  readonly metadata = { name: "event-emitter", version: "1.0.0" };

  private events = new Map<string, EventHandler[]>();

  constructor() {
    this.on = this.on.bind(this);
    this.off = this.off.bind(this);
    this.emit = this.emit.bind(this);
    this.once = this.once.bind(this);
    this.listenerCount = this.listenerCount.bind(this);
  }

  setup(_ctx: PluginContext): void {}

  on(event: string, handler: EventHandler): void {
    const handlers = this.events.get(event) ?? [];
    handlers.push(handler);
    this.events.set(event, handlers);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.events.get(event);
    if (!handlers) return;
    const idx = handlers.indexOf(handler);
    if (idx !== -1) {
      handlers.splice(idx, 1);
    }
    if (handlers.length === 0) {
      this.events.delete(event);
    }
  }

  emit(event: string, ...args: unknown[]): void {
    const handlers = this.events.get(event);
    if (!handlers) return;
    for (const handler of [...handlers]) {
      handler(...args);
    }
  }

  once(event: string, handler: EventHandler): void {
    const wrapper: EventHandler = (...args: unknown[]) => {
      this.off(event, wrapper);
      handler(...args);
    };
    this.on(event, wrapper);
  }

  listenerCount(event: string): number {
    return this.events.get(event)?.length ?? 0;
  }
}

const emitter = new EventEmitterPlugin();
export default emitter;
