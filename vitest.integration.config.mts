import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: { alias: { "@": root, "server-only": fileURLToPath(new URL("./tests/integration/server-only.ts", import.meta.url)) } },
  test: { include: ["tests/integration/**/*.test.ts"], fileParallelism: false, testTimeout: 20_000 },
});
