import { rm } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDirectory, "..");
const generatedDirectories = [".next", ".open-next"];

for (const directory of generatedDirectories) {
  const target = resolve(appRoot, directory);
  if (dirname(target) !== appRoot || !target.endsWith(`${sep}${directory}`)) {
    throw new Error(`Refusing to clean an unexpected OpenNext path: ${target}`);
  }
  await rm(target, { force: true, maxRetries: 3, recursive: true, retryDelay: 100 });
}
