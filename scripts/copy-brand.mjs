import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "apps/web/public");
mkdirSync(dest, { recursive: true });
copyFileSync(join(root, "hw3d-logo.png"), join(dest, "hw3d-logo.png"));
copyFileSync(join(root, "hw3d-logo-loop.gif"), join(dest, "hw3d-logo-loop.gif"));
