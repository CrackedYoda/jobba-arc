import { rmSync } from "node:fs";

// Next may leave development-only generated route types beside build types.
// Loading both can make a clean tsc run compare incompatible route manifests.
rmSync(".next/dev/types", { recursive: true, force: true });
