import { PluginManager, type IPlugin, type PluginContext } from "../mod.ts";

interface EventsPluginType {
  metadata: { name: string; version: string };
  setup(ctx: PluginContext): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
}

interface OrdersPluginType {
  metadata: { name: string; version: string };
  setup(ctx: PluginContext): void;
  createOrder(product: string): void;
}

interface NotificationsPluginType {
  metadata: { name: string; version: string };
  setup(ctx: PluginContext): void;
  send(message: string): void;
}

const EventsPlugin: EventsPluginType = {
  metadata: { name: "events", version: "1.0.0" },
  setup(_ctx: PluginContext) {
    console.log("[events] ready");
  },
  on(event: string, handler: (...args: unknown[]) => void) {
    if (!this.listeners) (this as any).listeners = new Map();
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(handler);
  },
  emit(event: string, ...args: unknown[]) {
    const handlers = this.listeners?.get(event) ?? [];
    for (const handler of handlers) handler(...args);
  },
  listeners: new Map<string, Array<(...args: unknown[]) => void>>(),
};

class OrdersPlugin implements IPlugin, OrdersPluginType {
  readonly metadata = { name: "orders", version: "1.0.0" };
  private events: EventsPluginType | undefined;

  setup(ctx: PluginContext) {
    this.events = ctx.getPlugin<EventsPluginType>("events");
    console.log("[orders] ready");
  }

  createOrder(product: string) {
    console.log(`[orders] order created: ${product}`);
    this.events?.emit("order.created", { product, timestamp: Date.now() });
  }
}

class NotificationsPlugin implements IPlugin, NotificationsPluginType {
  readonly metadata = { name: "notifications", version: "1.0.0" };
  private events: EventsPluginType | undefined;

  setup(ctx: PluginContext) {
    this.events = ctx.getPlugin<EventsPluginType>("events");
    this.events?.on("order.created", (data) => {
      this.send(`New order received: ${(data as any).product}`);
    });
    console.log("[notifications] ready");
  }

  send(message: string) {
    console.log(`[notifications] ${message}`);
  }
}

const manager = new PluginManager();

manager.register(EventsPlugin);
manager.register(new OrdersPlugin());
manager.register(new NotificationsPlugin());

await manager.init();

const orders = manager.getPlugin<OrdersPluginType>("orders");
orders?.createOrder("Laptop");

await manager.shutdown();
