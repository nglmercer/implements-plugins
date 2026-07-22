import { PluginManager, loadPluginsFromDir } from "../../mod.ts";
import path from "node:path";
import { existsSync } from "node:fs";
import { runTray } from "./tray.ts";
import type { EventEmitterPluginType } from "./plugins/event-emitter.ts";

function resolvePluginsDir(): string {
  const candidates: string[] = [];

  // 1. Standard source layout (dev / node)
  if (import.meta.dirname) {
    candidates.push(path.join(import.meta.dirname, "plugins"));
  }

  // 2. Compiled Bun binary — find real binary directory
  const isCompiledBinary =
    import.meta.dirname?.startsWith("/$bunfs/") ||
    process.execPath.includes("/bun") ||
    import.meta.url.startsWith("bun:");

  if (isCompiledBinary) {
    // Try argv[1] (binary path as invoked)
    if (process.argv[1]) {
      const binDir = path.dirname(path.resolve(process.argv[1]));
      candidates.push(path.join(binDir, "plugins"));
    }
    // Try cwd
    candidates.push(path.join(process.cwd(), "plugins"));
  }

  for (const dir of candidates) {
    if (existsSync(dir)) {
      return dir;
    }
  }

  console.warn("[main] plugins/ not found, candidates checked:");
  for (const dir of candidates) {
    console.warn(`  ${dir}`);
  }
  return candidates[0];
}

async function main(): Promise<void> {
  const manager = new PluginManager();

  const dirPath = resolvePluginsDir();

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
