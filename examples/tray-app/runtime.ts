import { readFileSync, writeFileSync } from "node:fs";

export function env(key: string): string | undefined {
  return process.env[key];
}

export function readTextFile(path: string): string {
  return readFileSync(path, "utf-8");
}

export function writeTextFile(path: string, content: string): void {
  writeFileSync(path, content);
}

export function args(): string[] {
  return process.argv.slice(2);
}

export function exit(code = 0): void {
  process.exit(code);
}

export function onSignal(sig: NodeJS.Signals, handler: () => void): void {
  process.on(sig, handler);
}
