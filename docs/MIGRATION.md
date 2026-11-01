# Migrating from Solana to Arc USDC

Jobba Freelance started as a Solana marketplace: an Anchor escrow program, a Next.js app with
route handlers, and a PostgreSQL database. This repository replaces that stack with one monorepo
where USDC on Arc Testnet is the only currency and the marketplace state lives in one Solidity
contract. The original Solana code is preserved in git history (see the commit
"Remove Solana and Postgres implementation").

| Before (Solana) | After (Arc) |
| --- | --- |
| Anchor escrow program | `contracts/JobbaEscrow.sol` |
| SPL USDC, SOL for fees | Arc USDC (ERC-20, 6 decimals). USDC is also the gas token. |
| Sign-In With Solana, session cookies | Wallet connection (wagmi, ConnectKit). The wallet signs every transaction. |
| Server builds unsigned transactions, reconciles on-chain | The browser sends transactions directly and reads contract state. |
| PostgreSQL: projects, proposals, chat, disputes | Contract storage: jobs, proposals, posts (chat, deliveries, evidence) |
| Admin dispute queue | Arbiter role in the contract, "Disputes" tab in the web app |

## What was not carried over

- Freelancer profiles and the freelancer directory. They were database-only features.
- Fiat, hourly contracts, agencies, split awards and multiple milestones (not supported in the original either).

## Behaviour added by the Arc contract

- 7 day client review window, then the freelancer can claim payment.
- Client can reclaim the escrow after the delivery deadline.
- Up to 3 revision requests per contract.
- Disputes that no arbiter rules on within 30 days settle to the pre-dispute outcome.
- A payout that fails (for example a blocklisted recipient) is credited and withdrawn separately, so it cannot block the other party.
