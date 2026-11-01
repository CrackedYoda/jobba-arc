# Jobba Freelance Web

Responsive Next.js marketplace for clients and freelancers using wallet sign-in, PostgreSQL persistence, chat, and Solana USDC escrow.

## Configure

Copy `.env.example` to `.env.local` and fill the blank values. Never commit `.env.local`.

Required for wallet sign-in:

- `NEXT_PUBLIC_REOWN_PROJECT_ID`
- `NEXT_PUBLIC_APP_URL`
- `SIWS_DOMAIN`
- `DATABASE_URL`

Required for escrow transactions:

- `NEXT_PUBLIC_USDC_MINT` and `SOLANA_USDC_MINT`
- `SOLANA_ADMIN_WALLET`
- `SOLANA_TREASURY_WALLET`
- `CHAIN_RECONCILE_SECRET`

The deployed devnet program is already recorded in `.env.example` as `CwNiWw9TSRDnszphzCHsShxC64VhgbawWxCLnZ9gLhxy`.

`SOLANA_DEPLOYMENT_MANIFEST_JSON` is the authoritative transaction configuration. Its JSON shape is shown directly in `.env.example`; keep its program, mint, admin, treasury, cluster, and fee consistent with the individual environment variables.

## Run

```sh
npm ci
npm run dev
```

The PostgreSQL container, migrations, demo seed, and Anchor program live in the separate `jobba-freelance-backend` repository. Start its database and run its reset script before exercising authenticated marketplace flows.

## Verify

```sh
npm run verify
npm run test:db
npm run verify:deploy
```

`npm run test:db` requires a migrated database at `DATABASE_URL`. `npm run verify:deploy` additionally rejects missing production and chain configuration before deployment.
