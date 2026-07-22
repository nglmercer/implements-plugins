import type {
  IPlugin,
  PluginConst,
  PluginContext,
  PluginInput,
  PluginManagerOptions,
} from "./types.ts";
import { validatePlugin } from "./validation.ts";

interface PluginEntry {
  plugin: PluginConst;
  raw: PluginInput;
}

export class PluginManager {
  private plugins = new Map<string, PluginEntry>();
  private initialized = false;
  private context: PluginContext;

  constructor(_options?: PluginManagerOptions) {
    this.context = {
      getPlugin: <T = unknown>(name: string): T | undefined => {
        return this.getPlugin<T>(name);
      },
      getPlugins: (): string[] => {
        return this.getPlugins();
      },
    };
  }

  register(plugin: PluginInput): void {
    validatePlugin(plugin);

    const metadata = this.getMetadata(plugin);
    if (this.plugins.has(metadata.name)) {
      throw new Error(`Plugin "${metadata.name}" is already registered`);
    }

    const normalized = this.normalize(plugin);
    this.plugins.set(metadata.name, { plugin: normalized, raw: plugin });
  }

  getPlugin<T = unknown>(name: string): T | undefined {
    const entry = this.plugins.get(name);
    return entry ? (entry.raw as T) : undefined;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    for (const [, entry] of this.plugins) {
      const p = entry.plugin;
      if (typeof p.setup === "function") {
        await p.setup(this.context);
      }
      if (typeof p.onLoad === "function") {
        await p.onLoad(this.context);
      }
    }
  }

  async shutdown(): Promise<void> {
    for (const [, entry] of this.plugins) {
      const p = entry.plugin;
      if (typeof p.onDisable === "function") {
        await p.onDisable(this.context);
      }
      if (typeof p.onUnload === "function") {
        await p.onUnload(this.context);
      }
    }
    this.plugins.clear();
    this.initialized = false;
  }

  getPlugins(): string[] {
    return [...this.plugins.keys()];
  }

  has(name: string): boolean {
    return this.plugins.has(name);
  }

  getContext(): PluginContext {
    return this.context;
  }

  private getMetadata(plugin: PluginInput): { name: string; version: string } {
    if (typeof plugin === "function") {
      const proto = (plugin as { prototype?: Record<string, unknown> }).prototype;
      if (proto && typeof proto === "object" && "metadata" in proto) {
        return proto.metadata as { name: string; version: string };
      }
      const instance = new (plugin as new () => IPlugin)();
      return (instance as unknown as PluginConst).metadata;
    }
    return (plugin as IPlugin | PluginConst).metadata;
  }

  private normalize(plugin: PluginInput): PluginConst {
    if (typeof plugin === "function") {
      const instance = new (plugin as new () => IPlugin)();
      return instance as unknown as PluginConst;
    }
    return plugin as PluginConst;
  }
}
