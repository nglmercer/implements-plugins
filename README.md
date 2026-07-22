# Universal Plugin System

A universal, minimal plugin system for **Node.js**, **Deno**, and **Bun**. Supports class-based plugins, plain-object plugins, dynamic file/URL imports, directory scanning, and manifest-based loading.

## Installation

- **Deno**: import from your local path or deno.land/x / jsr.
- **Bun / Node**: use `import { ... } from "./mod.ts"` (works natively in all three).
- **npm**: `npm install @deno/plugin-system` then `import { ... } from "@deno/plugin-system"`.

## Build

The project uses [tsup](https://tsup.xyz) to produce a single `index.js` and `index.d.ts` in `dist/`:

```bash
npm run build
```

This outputs:

- `dist/index.js` — bundled ESM entry point
- `dist/index.cjs` — bundled CommonJS entry point
- `dist/index.d.ts` — TypeScript declarations

For development, use the watch mode:

```bash
npm run build:watch
```

## Core Concepts

1. **`IPlugin`** - interface with `metadata`, optional hooks (`setup`, `onLoad`, `onEnable`, `onDisable`, `onUnload`).
2. **`PluginConst`** - plain-object plugin (same shape as `IPlugin`).
3. **`PluginContext`** - passed to every hook, provides `getPlugin()` and `getPlugins()` for inter-plugin communication.
4. **`PluginInput`** - union of `IPlugin | PluginConst | (new () => IPlugin)`.
5. **`PluginManager`** - register, init, retrieve, and shut down plugins.
6. **Loaders** - `loadPluginFromFile`, `loadPluginFromUrl`, `loadPluginsFromDir`, `loadPluginsFromManifest`.

## Basic Usage

```typescript
import { PluginManager, type IPlugin, type PluginContext } from "./mod.ts";

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
```

## Plugin Communication

Every lifecycle hook receives a `PluginContext` that lets plugins resolve sibling plugins via `getPlugin()`. This enables decoupled inter-plugin communication — no shared state needed.

```typescript
interface EventsPluginType {
  metadata: { name: string; version: string };
  setup(ctx: PluginContext): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
}

const EventsPlugin: EventsPluginType = {
  metadata: { name: "events", version: "1.0.0" },
  setup(_ctx: PluginContext) {},
  on(event, handler) { /* store handler */ },
  emit(event, ...args) { /* call handlers */ },
};

class OrdersPlugin implements IPlugin {
  readonly metadata = { name: "orders", version: "1.0.0" };

  setup(ctx: PluginContext) {
    const events = ctx.getPlugin<EventsPluginType>("events");
    events?.emit("order.created", { product: "Laptop" });
  }
}

class NotificationsPlugin implements IPlugin {
  readonly metadata = { name: "notifications", version: "1.0.0" };

  setup(ctx: PluginContext) {
    const events = ctx.getPlugin<EventsPluginType>("events");
    events?.on("order.created", (data) => {
      console.log("Notify:", data);
    });
  }
}
```

> **Why `ctx` in every hook?** Not just `setup`. During `shutdown`, the context lets plugins gracefully notify others before being unloaded. Each hook gets a fresh reference that reflects the current plugin set.

## File Loaders

### Load a single plugin from file

```typescript
import { loadPluginFromFile } from "./mod.ts";

const plugin = await loadPluginFromFile("./plugins/logger.ts");
```

### Load all plugins from a directory

```typescript
import { loadPluginsFromDir } from "./mod.ts";

const plugins = await loadPluginsFromDir("./plugins");
for (const plugin of plugins) {
  manager.register(plugin);
}
```

### Load from a manifest (recommended for larger apps)

```typescript
import { loadPluginsFromManifest, type PluginManifest } from "./mod.ts";

const manifest: PluginManifest = {
  plugins: [
    { path: "./plugins/logger.ts" },
    { path: "./plugins/greeter.ts" },
    { url: "https://example.com/remote-plugin.js" },
  ],
};

const plugins = await loadPluginsFromManifest(manifest, process.cwd());
```

## Runtime Support

| Runtime | Status | Notes |
|---------|--------|-------|
| Node.js (>=18) | ✅ | uses `node:` builtins |
| Bun | ✅ | uses `node:` builtins + `node:test` |
| Deno | ✅ | uses Deno compatibility layer for `node:` |

## License

MIT
