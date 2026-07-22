import type { IPlugin, PluginContext } from "../../../mod.ts";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { env, readTextFile, writeTextFile } from "../runtime.ts";

export interface StoragePluginType {
  metadata: { name: string; version: string };
  get<T = unknown>(key: string): T | undefined;
  set<T = unknown>(key: string, value: T): void;
  remove(key: string): void;
  clear(): void;
  keys(): string[];
  has(key: string): boolean;
}

interface StorageData {
  [key: string]: unknown;
}

class StoragePlugin implements IPlugin {
  readonly metadata = { name: "storage", version: "1.0.0" };

  private data: StorageData = {};
  private filePath: string = "";
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  private writeDelay = 100;

  private getDefaultPath(): string {
    const home = env("HOME") ?? env("USERPROFILE") ?? ".";
    const xdgData = env("XDG_DATA_HOME");

    if (xdgData) {
      return path.join(xdgData, "tray-app", "storage.json");
    }

    return path.join(home, ".local", "share", "tray-app", "storage.json");
  }

  private ensureDirSync(dir: string): void {
    mkdirSync(dir, { recursive: true });
  }

  setup(_ctx: PluginContext): void {
    this.filePath = this.getDefaultPath();
    this.load();
  }

  private load(): void {
    try {
      const content = readTextFile(this.filePath);
      this.data = JSON.parse(content) as StorageData;
    } catch {
      this.data = {};
    }
  }

  flush(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    try {
      const dir = path.dirname(this.filePath);
      this.ensureDirSync(dir);
      writeTextFile(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error("[storage] write failed:", err);
    }
  }

  get<T = unknown>(key: string): T | undefined {
    return this.data[key] as T | undefined;
  }

  set<T = unknown>(key: string, value: T): void {
    this.data[key] = value;
    this.flush();
  }

  remove(key: string): void {
    delete this.data[key];
    this.flush();
  }

  clear(): void {
    this.data = {};
    this.flush();
  }

  keys(): string[] {
    return Object.keys(this.data);
  }

  has(key: string): boolean {
    return key in this.data;
  }
}

const storage = new StoragePlugin();
export default storage;
