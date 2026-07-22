import {
  TrayIconBuilder,
  CheckMenuItemBuilder,
  MenuItemBuilder,
  PredefinedMenuItem,
  Menu,
  Icon,
  initialize,
  update,
  pollTrayEvents,
  pollMenuEvents,
} from "tray-icon-node";
import type { TrayIcon } from "tray-icon-node";
import type { PluginManager } from "../../mod.ts";
import { loadPluginsFromDir } from "../../mod.ts";
import path from "node:path";

// ---------------------------------------------------------------------------
// Icon
// ---------------------------------------------------------------------------

function createIcon(r: number, g: number, b: number, size = 32): Icon {
  const data = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4 + 0] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return Icon.fromRgba(data, size, size);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let manager: PluginManager;
let tray: TrayIcon | null = null;
let menu: Menu | null = null;
let isRunning = true;

// ---------------------------------------------------------------------------
// Menu builder (dynamic)
// ---------------------------------------------------------------------------

function buildMenu(): Menu {
  const m = new Menu();

  const allPlugins = manager.getPlugins();
  const enabled = manager.getEnabledPlugins();

  /* ---- Header ---- */
  const header = new MenuItemBuilder()
    .withText(`${enabled.length}/${allPlugins.length} plugins active`)
    .withId("__header__")
    .withEnabled(false)
    .build();
  m.appendMenuItem(header, "__header__");

  m.appendPredefinedMenuItem(PredefinedMenuItem.separator());

  /* ---- Plugin list (click to toggle) ---- */
  for (const name of allPlugins) {
    const isEnabled = enabled.includes(name);
    const item = new CheckMenuItemBuilder()
      .withText(`${name}`)
      .withId(`toggle:${name}`)
      .withChecked(isEnabled)
      .build();
    m.appendCheckMenuItem(item, `toggle:${name}`);
  }

  m.appendPredefinedMenuItem(PredefinedMenuItem.separator());

  /* ---- Actions ---- */
  const reload = new MenuItemBuilder()
    .withText("Reload Menu")
    .withId("__reload__")
    .build();
  m.appendMenuItem(reload, "__reload__");

  m.appendPredefinedMenuItem(PredefinedMenuItem.separator());

  /* ---- Quit ---- */
  const quit = new MenuItemBuilder()
    .withText("✕ Quit")
    .withId("__quit__")
    .build();
  m.appendMenuItem(quit, "__quit__");

  return m;
}

function rebuildMenu(): void {
  menu = buildMenu();
  if (tray) {
    tray.setVisible(false);
    tray = new TrayIconBuilder()
      .withIcon(createIcon(80, 160, 240))
      .withTitle("Plugins")
      .withTooltip(tooltip())
      .withMenu(menu)
      .build();
  }
}

function tooltip(): string {
  const enabled = manager.getEnabledPlugins().length;
  const total = manager.getPlugins().length;
  return `Plugin Manager — ${enabled}/${total} active`;
}

// ---------------------------------------------------------------------------
// Plugin actions
// ---------------------------------------------------------------------------

async function reloadPlugins(): Promise<void> {
  const dirPath = import.meta.dirname
    ? path.join(import.meta.dirname, "plugins")
    : "./plugins";

  manager.shutdown();

  const plugins = await loadPluginsFromDir(dirPath);
  for (const plugin of plugins) {
    manager.loadPlugin(plugin, dirPath);
  }

  rebuildMenu();
  console.log(`[tray] Reloaded ${plugins.length} plugin(s)`);
}

function togglePlugin(name: string): void {
  const state = manager.getState(name);
  if (state === "enabled") {
    manager.disable(name);
    menu?.setText(`toggle:${name}`, `${name}`);
    console.log(`[tray] Disabled: ${name}`);
  } else {
    manager.enable(name);
    menu?.setText(`toggle:${name}`, `${name}`);
    console.log(`[tray] Enabled: ${name}`);
  }
  const enabled = manager.getEnabledPlugins().length;
  const total = manager.getPlugins().length;
  menu?.setText("__header__", `${enabled}/${total} plugins active`);
  tray?.setTooltip(tooltip());
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function handleMenuEvent(): void {
  const event = pollMenuEvents();
  if (!event) return;

  if (event.id === "__quit__") {
    shutdown();
  } else if (event.id === "__reload__") {
    reloadPlugins();
  } else if (event.id?.startsWith("toggle:")) {
    togglePlugin(event.id.slice("toggle:".length));
  }
}

function handleTrayEvent(): void {
  const event = pollTrayEvents();
  if (!event) return;
  if (event.eventType === "double-click") {
    reloadPlugins();
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

function shutdown(): void {
  console.log("[tray] Shutting down...");
  isRunning = false;
}

function setupSignalHandlers(): void {
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      console.log(`\n[tray] Received ${sig}`);
      shutdown();
    });
  }
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function runTray(mgr: PluginManager): Promise<void> {
  console.log("starting Tray");

  manager = mgr;
  initialize();

  menu = buildMenu();

  tray = new TrayIconBuilder()
    .withIcon(createIcon(80, 160, 240))
    .withTitle("Plugins")
    .withTooltip(tooltip())
    .withMenu(menu)
    .build();

  setupSignalHandlers();

  console.log(`[tray] ${manager.getEnabledPlugins().length} plugins loaded.`);
  console.log("[tray] Press Ctrl+C to quit.\n");

  while (isRunning) {
    update();
    handleTrayEvent();
    handleMenuEvent();
    await new Promise((r) => setTimeout(r, 32));
  }

  tray = null;
  menu = null;
  process.exit(0);
}
