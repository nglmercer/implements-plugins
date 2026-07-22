export interface PluginMetadata {
  name: string;
  version: string;
}

export interface PluginContext {
  getPlugin<T = unknown>(name: string): T | undefined;
  getPlugins(): string[];
}

export interface IPlugin {
  readonly metadata: PluginMetadata;
  setup?(ctx: PluginContext): void | Promise<void>;
  onLoad?(ctx: PluginContext): void | Promise<void>;
  onEnable?(ctx: PluginContext): void | Promise<void>;
  onDisable?(ctx: PluginContext): void | Promise<void>;
  onUnload?(ctx: PluginContext): void | Promise<void>;
}

export type PluginConst = {
  metadata: PluginMetadata;
  setup?: (ctx: PluginContext) => void | Promise<void>;
  onLoad?: (ctx: PluginContext) => void | Promise<void>;
  onEnable?: (ctx: PluginContext) => void | Promise<void>;
  onDisable?: (ctx: PluginContext) => void | Promise<void>;
  onUnload?: (ctx: PluginContext) => void | Promise<void>;
};

export type PluginInput = IPlugin | PluginConst | (new () => IPlugin);

export type PluginManagerOptions = Record<string, unknown>;

export interface PluginManifest {
  plugins: Array<{
    path?: string;
    url?: string;
  }>;
}
