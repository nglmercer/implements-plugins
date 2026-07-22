import { PluginManager, loadPluginsFromDir } from "../../mod.ts";
import path from "node:path";
import { runTray } from "./tray.ts";
import type { EventEmitterPluginType } from "./plugins/event-emitter.ts";
async function main(): Promise<void> {
  const manager = new PluginManager();

  const dirPath = import.meta.dirname
    ? path.join(import.meta.dirname, "plugins")
    : "./plugins";

  const plugins = await loadPluginsFromDir(dirPath);
  for (const plugin of plugins) {
    manager.loadPlugin(plugin, dirPath);
  }
  const emitter = manager.getPlugin('event-emitter') as EventEmitterPluginType;
  //console.log("emitter",emitter)
  if (emitter) {
    emitter.on('tiktok', (a) => {
      if (typeof a !== 'object' || a === null) return;
      const keys = Object.keys(a);
      console.log(keys)
    });
  }
  await runTray(manager);
}

main();
