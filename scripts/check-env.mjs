import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const modes = new Set(["shell", "wallet", "server", "deploy"]);
const mode = process.argv[2] ?? "shell";

if (!modes.has(mode)) {
  console.error(`Unknown environment mode: ${mode}`);
  process.exit(2);
}

const required = {
  shell: [],
  wallet: ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_REOWN_PROJECT_ID", "NEXT_PUBLIC_SOLANA_CLUSTER"],
  server: [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_REOWN_PROJECT_ID",
    "NEXT_PUBLIC_SOLANA_CLUSTER",
    "NEXT_PUBLIC_SOLANA_PROGRAM_ID",
    "NEXT_PUBLIC_USDC_MINT",
    "SOLANA_RPC_URL",
    "SOLANA_PROGRAM_ID",
    "SOLANA_USDC_MINT",
    "DATABASE_URL",
    "SIWS_DOMAIN",
    "CHAIN_RECONCILE_SECRET",
  ],
  deploy: [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_REOWN_PROJECT_ID",
    "NEXT_PUBLIC_SOLANA_CLUSTER",
    "NEXT_PUBLIC_SOLANA_PROGRAM_ID",
    "NEXT_PUBLIC_USDC_MINT",
    "NEXT_PUBLIC_PLATFORM_FEE_BPS",
    "SOLANA_RPC_URL",
    "SOLANA_PROGRAM_ID",
    "SOLANA_USDC_MINT",
    "SOLANA_ADMIN_WALLET",
    "SOLANA_TREASURY_WALLET",
    "SOLANA_DEPLOYMENT_MANIFEST_JSON",
    "DATABASE_URL",
    "SIWS_DOMAIN",
    "CHAIN_RECONCILE_SECRET",
  ],
};

const missing = required[mode].filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error(`Missing ${mode} configuration: ${missing.join(", ")}`);
  process.exit(1);
}

const publicProgram = process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID;
const serverProgram = process.env.SOLANA_PROGRAM_ID;
const publicMint = process.env.NEXT_PUBLIC_USDC_MINT;
const serverMint = process.env.SOLANA_USDC_MINT;

if (publicProgram && serverProgram && publicProgram !== serverProgram) {
  console.error("Public and server Solana program IDs do not match.");
  process.exit(1);
}

if (publicMint && serverMint && publicMint !== serverMint) {
  console.error("Public and server USDC mint addresses do not match.");
  process.exit(1);
}

const feeBps = process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS;
if (feeBps && (!/^\d+$/.test(feeBps) || Number(feeBps) > 10_000)) {
  console.error("NEXT_PUBLIC_PLATFORM_FEE_BPS must be an integer from 0 to 10000.");
  process.exit(1);
}

if (process.env.SOLANA_DEPLOYMENT_MANIFEST_JSON) {
  try {
    const manifest = JSON.parse(process.env.SOLANA_DEPLOYMENT_MANIFEST_JSON);
    if (manifest.version !== 1 || manifest.cluster !== process.env.NEXT_PUBLIC_SOLANA_CLUSTER) {
      throw new Error("version or cluster mismatch");
    }
  } catch (error) {
    console.error(`Invalid SOLANA_DEPLOYMENT_MANIFEST_JSON: ${error instanceof Error ? error.message : "parse failure"}.`);
    process.exit(1);
  }
}

console.log(`Environment check passed for ${mode} mode.`);
