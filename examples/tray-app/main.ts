import { PluginManager, loadPluginsFromDir } from "../../mod.ts";
import path from "node:path";
import { runTray } from "./tray.ts";

async function main(): Promise<void> {
  const manager = new PluginManager();

  const dirPath = import.meta.dirname
    ? path.join(import.meta.dirname, "plugins")
    : "./plugins";

  const plugins = await loadPluginsFromDir(dirPath);
  for (const plugin of plugins) {
    manager.loadPlugin(plugin, dirPath);
  }

  await runTray(manager);
}

main();
