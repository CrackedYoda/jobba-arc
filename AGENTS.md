# Jobba Freelance

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

Wallet-native freelance marketplace on Arc Testnet. Converted from a Solana/Anchor + Postgres app. All marketplace state (jobs, proposals, chat, deliveries, evidence) lives in `contracts/JobbaEscrow.sol`; USDC (ERC-20, 6 decimals) is the only currency.

## Deployed contracts

- JobbaEscrow (Arc Testnet): `0xd16572ab00d44a4b6124f7f86be3eb7b4bb5da66` (address in `.env` as `VITE_JOBBA_ESCROW_ADDRESS`). Constructor: USDC `0x3600...0000`, admin = platform deployer wallet (owner and first arbiter). The admin wallet is not the user's, so arbiter rulings are not available from a user wallet; disputes settle through the 30 day timeout unless redeployed with the user's wallet as admin.
- ABI lives in `src/contracts/jobbaAbi.ts` (generated from the Foundry artifact; regenerate after any contract change).

## Key rules

- Review window 7 days, arbiter timeout 30 days, max 3 revisions.
- Stale disputes settle to the pre-dispute outcome (delivered: freelancer paid; not delivered: client refunded).
- Failed payouts (e.g. blocklisted recipient) are credited to `claimable` and withdrawn via `withdraw()`.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## Share links

- Starter apps already ship `getShareBase`, `buildShareLink` and `installShareSync` in `src/lib/share.ts`; import them instead of rewriting them.
- Keep shareable state in the URL path or query, not in the `#fragment`.
- Never put a secret (private key, claim secret, seed phrase, session token, API key) in the URL path or query, encoded or not: every in-app path and query is mirrored to the visitor's studio.arc.io address bar and browser history and reaches servers. A bearer claim secret goes only in the `#fragment` appended to the share link (`` `${await buildShareLink('/claim')}#${secret}` ``) and is read from `location.hash` on load. A link to the app's own share URL shown inside the app must be copy-only or open in a new tab with `target="_blank" rel="noopener noreferrer"`.
- Build every link a user copies or sends with `buildShareLink()` from `src/lib/share.ts`.
- Keep the `installShareSync()` call in `src/main.tsx` when editing it; it keeps the Studio address bar in step with in-app navigation.
- Navigate inside the app with relative links.

## To Run

```bash
bun install
bun run dev
```


## Repository

Monorepo: web app in `src/`, Solidity in `contracts/`, notes in `docs/`. The Solana/Next.js/Postgres implementation was removed and lives only in git history (see `docs/MIGRATION.md`). Local git identity is set per-repo.
