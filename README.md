# Jobba Freelance

A freelance marketplace settled in USDC on Arc Testnet. Clients post fixed-price projects, freelancers send proposals, and the client's payment is held in escrow until the work is approved. Disputes are ruled on by an arbiter, and unresolved disputes settle automatically after 30 days.

Built with [Arc Studio](https://studio.arc.io)

## What you can do

- Post a project with a maximum USDC budget.
- Send proposals with your own price and delivery time.
- Accept a proposal to fund the escrow in USDC.
- Chat in the project thread, deliver work, request up to 3 revisions, and release payment.
- Open a dispute and add evidence. An arbiter either pays the freelancer or refunds the client.
- Freelancers start work, then deliver. Clients can cancel for a full refund until work starts.
- Get paid automatically if a client does not review within 7 days, or get a refund if the freelancer misses the deadline.
- An optional platform fee (up to 10%) is taken from the freelancer's payment only. Refunds are always fee-free.
- The platform can pause new funding without blocking anyone from getting their money out.

## Repository layout

One monorepo holds the whole product:

- `src/`: the web app (React, Vite, wagmi).
- `admin/`: the admin console, a separate page served at `/admin/`. It shows platform stats, and lets the contract owner change the fee and treasury, pause funding, manage arbiters and transfer ownership. Arbiters rule on disputes there.
- `contracts/`: the Solidity escrow contract and Foundry config. `contracts/contract-metadata/` records the Arc Testnet deployment.
- `scripts/`: deploy helpers.
- `docs/MIGRATION.md`: how the original Solana, Next.js and Postgres version maps to this one.

## Tech stack

- React, Vite, TypeScript, Tailwind CSS
- wagmi, viem, ConnectKit
- Solidity 0.8.28 with Foundry and OpenZeppelin
- Arc Testnet, USDC

## Development

Prerequisites: [Bun](https://bun.sh) and [Foundry](https://getfoundry.sh).

```bash
bun install
bun run dev
```

Other commands:

```bash
bun run lint
bun run typecheck
bun run contracts:build  # compile the escrow contract
bun run contracts:test   # run contract tests
```

### Environment variables

- `VITE_JOBBA_ESCROW_ADDRESS`: address of the deployed escrow contract on Arc Testnet.
- `VITE_JOBBA_DEPLOY_TX`: transaction hash of that deployment (informational).
- `RPC_PROXY_BASE_URL`, `RPC_PROXY_TOKEN`, `RPC_PROXY_CHAINS`: optional outside Arc Studio. Provisioned by Arc Studio for RPC access.

Copy `.env.example` to `.env` and set `VITE_JOBBA_ESCROW_ADDRESS` before running the app.

### Getting test USDC

Connect a wallet on Arc Testnet and fund it from the Circle faucet at https://faucet.circle.com.
