import { PluginManager, type IPlugin, type PluginContext } from "../mod.ts";

// Class-based plugin
class LoggerPlugin implements IPlugin {
  readonly metadata = {
    name: "logger",
    version: "1.0.0",
  };

  setup(_ctx: PluginContext) {
    console.log("[logger] setup");
  }

  onLoad(_ctx: PluginContext) {
    console.log("[logger] loaded");
  }

  log(message: string) {
    console.log(`[logger] ${message}`);
  }
}

// Const-based plugin with custom type
interface GreeterPluginType {
  metadata: { name: string; version: string };
  setup(ctx: PluginContext): void;
  greet(name: string): void;
}

const GreeterPlugin: GreeterPluginType = {
  metadata: {
    name: "greeter",
    version: "1.0.0",
  },
  setup(_ctx: PluginContext) {
    console.log("[greeter] setup");
  },
  greet(name: string) {
    console.log(`Hello, ${name}!`);
  },
};

const manager = new PluginManager();

manager.register(new LoggerPlugin());
manager.register(GreeterPlugin);

await manager.init();

// Full access to plugin methods
const logger = manager.getPlugin<LoggerPlugin>("logger");
logger?.log("hello from app");

const greeter = manager.getPlugin<GreeterPluginType>("greeter");
greeter?.greet("World");

await manager.shutdown();
