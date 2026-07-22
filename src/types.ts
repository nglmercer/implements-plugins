export interface PluginMetadata {
  name: string;
  version: string;
  dependencies?: string[];
}

export enum PluginState {
  DISABLED = "disabled",
  ENABLED = "enabled",
}

export interface PluginContext {
  getPlugin<T = unknown>(name: string): T | undefined;
  getPlugins(): string[];
  getManager(): PluginManagerLike;
}

export interface PluginManagerLike {
  register(plugin: PluginInput, path?: string): void;
  unregister(name: string): void;
  enable(name: string): void;
  disable(name: string): void;
  loadPlugin(plugin: PluginInput, path?: string): void;
  getPlugin<T = unknown>(name: string): T | undefined;
  getPluginRaw<T = unknown>(name: string): T | undefined;
  getPlugins(): string[];
  getEnabledPlugins(): string[];
  getDisabledPlugins(): string[];
  getState(name: string): PluginState | undefined;
  getPath(name: string): string | undefined;
  has(name: string): boolean;
  isInitialized(): boolean;
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
