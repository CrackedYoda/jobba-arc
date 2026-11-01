import "server-only";

import { randomUUID } from "node:crypto";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

import { getServerEnv } from "@/lib/config/env";
import { getSolanaDeployment } from "@/lib/solana/deployment";
import { ASSOCIATED_TOKEN_PROGRAM_ID, SYSTEM_PROGRAM_ID, associatedTokenAddress, buildEscrowInstruction, configPda, escrowPda, hashContractId } from "@/lib/solana/program";
import type { EscrowAction, UnsignedEscrowTransaction } from "@/lib/solana/types";
import { decodeConfig, decodeEscrow, parseBytea32 } from "@/server/solana/accounts";
import { SolanaBoundaryError, solanaDatabase } from "@/server/solana/context";

const allowedStates: Record<EscrowAction, readonly string[]> = {
  fund: ["funding_pending"], accept: ["funded"], submit: ["active"], release: ["submitted"], cancel: ["funded"],
  open_dispute: ["funded", "active", "submitted"], refund: ["disputed"], award: ["disputed"],
};
const requiredEscrowStates: Partial<Record<EscrowAction, readonly string[]>> = {
  accept: ["funded"], submit: ["active"], release: ["submitted"], cancel: ["funded"],
  open_dispute: ["funded", "active", "submitted"], refund: ["disputed"], award: ["disputed"],
};

type Party = { id: string; wallet_public_key: string };
type ContractRow = { id: string; client_id: string; freelancer_id: string; amount_atomic: string | number; currency_mint: string; terms_hash: unknown; status: string; version: string | number; escrow_pda: string | null; client: Party; freelancer: Party };

export function solanaConnection(): Connection {
  const rpc = getServerEnv().SOLANA_RPC_URL;
  if (!rpc) throw new SolanaBoundaryError("RPC_NOT_CONFIGURED", "Solana RPC is not configured.", 503);
  return new Connection(rpc, "confirmed");
}

async function loadContext(contractId: string, wallet: string) {
  const db = solanaDatabase();
  const [profile, contract] = await Promise.all([
    db.query<{ id: string; wallet_public_key: string }>("select id, wallet_public_key from profiles where wallet_public_key = $1", [wallet]),
    db.query(`select c.id,c.client_id,c.freelancer_id,c.amount_atomic,c.currency_mint,c.terms_hash,c.status,c.version,c.escrow_pda,
      json_build_object('id',cp.id,'wallet_public_key',cp.wallet_public_key) as client,
      json_build_object('id',fp.id,'wallet_public_key',fp.wallet_public_key) as freelancer
      from contracts c join profiles cp on cp.id=c.client_id join profiles fp on fp.id=c.freelancer_id where c.id=$1`, [contractId]),
  ]);
  if (!profile.rows[0]) throw new SolanaBoundaryError("PROFILE_REQUIRED", "The signed-in wallet has no profile.", 403);
  if (!contract.rows[0]) throw new SolanaBoundaryError("CONTRACT_NOT_FOUND", "Contract was not found.", 404);
  return { db, actor: profile.rows[0], contract: contract.rows[0] as ContractRow };
}

async function authorize(db: ReturnType<typeof solanaDatabase>, actorId: string, contract: ContractRow, action: EscrowAction) {
  const requiredParty = action === "accept" || action === "submit" ? contract.freelancer_id : action === "fund" || action === "release" || action === "cancel" ? contract.client_id : undefined;
  if (requiredParty && actorId !== requiredParty) throw new SolanaBoundaryError("ACTION_FORBIDDEN", "This wallet cannot perform the requested action.", 403);
  if (action === "open_dispute" && ![contract.client_id, contract.freelancer_id].includes(actorId)) throw new SolanaBoundaryError("ACTION_FORBIDDEN", "Only a contract participant can open a dispute.", 403);
  if (action === "refund" || action === "award") {
    const role = await db.query("select 1 from profile_roles where profile_id=$1 and role='admin'", [actorId]);
    if (!role.rows[0]) throw new SolanaBoundaryError("ADMIN_REQUIRED", "An admin role is required.", 403);
  }
  if (["release", "cancel"].includes(action)) {
    const dispute = await db.query("select 1 from disputes where contract_id=$1 and status <> 'resolved' limit 1", [contract.id]);
    if (dispute.rows[0]) throw new SolanaBoundaryError("DISPUTE_PENDING", "Normal settlement is locked while a dispute is pending.", 409);
  }
  if (!allowedStates[action].includes(contract.status)) throw new SolanaBoundaryError("INVALID_CONTRACT_STATE", `Action ${action} is unavailable while the contract is ${contract.status}.`, 409);
}

function assertDeploymentConfig(data: Buffer, manifest: ReturnType<typeof getSolanaDeployment>, funding: boolean) {
  const config = decodeConfig(data);
  if (config.version !== 1 || config.admin !== manifest.admin || config.acceptedMint !== manifest.usdcMint || config.tokenProgram !== manifest.tokenProgramId || config.treasury !== manifest.treasury || config.feeBps !== manifest.feeBps) {
    throw new SolanaBoundaryError("DEPLOYMENT_CONFIG_MISMATCH", "Deployment manifest does not match the on-chain Config account.", 503);
  }
  if (funding && config.paused) throw new SolanaBoundaryError("FUNDING_PAUSED", "New escrow funding is paused.", 409);
}

export async function buildChainAction(contractId: string, action: EscrowAction, idempotencyKey: string, wallet: string): Promise<UnsignedEscrowTransaction> {
  const manifest = getSolanaDeployment();
  const { db, actor, contract } = await loadContext(contractId, wallet);
  await authorize(db, actor.id, contract, action);

  const program = new PublicKey(manifest.programId), mint = new PublicKey(manifest.usdcMint), tokenProgram = new PublicKey(manifest.tokenProgramId);
  const client = new PublicKey(contract.client.wallet_public_key), freelancer = new PublicKey(contract.freelancer.wallet_public_key);
  const admin = new PublicKey(manifest.admin), treasury = new PublicKey(manifest.treasury), actorKey = new PublicKey(wallet);
  const contractHash = hashContractId(contract.id), termsHash = parseBytea32(contract.terms_hash, "Contract terms hash"), amount = BigInt(contract.amount_atomic);
  if (amount <= 0n || contract.currency_mint !== manifest.usdcMint) throw new SolanaBoundaryError("CONTRACT_CHAIN_MISMATCH", "Contract amount or mint does not match the deployment.", 409);
  if ((action === "refund" || action === "award") && actorKey.toBase58() !== manifest.admin) throw new SolanaBoundaryError("ADMIN_WALLET_MISMATCH", "The signed-in admin is not the deployment admin.", 403);

  const config = configPda(program), escrow = escrowPda(program, config, contractHash), vault = associatedTokenAddress(mint, escrow, tokenProgram);
  if (contract.escrow_pda && contract.escrow_pda !== escrow.toBase58()) throw new SolanaBoundaryError("ESCROW_PDA_MISMATCH", "Stored escrow address does not match canonical seeds.", 409);
  const accounts = {
    client, freelancer, admin, participant: actorKey, treasury, config, escrow, mint, vault,
    clientToken: associatedTokenAddress(mint, client, tokenProgram), freelancerToken: associatedTokenAddress(mint, freelancer, tokenProgram), treasuryToken: associatedTokenAddress(mint, treasury, tokenProgram),
    tokenProgram, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SYSTEM_PROGRAM_ID,
  };
  const rpc = solanaConnection();
  const [configInfo, mintInfo, escrowInfo] = await rpc.getMultipleAccountsInfo([config, mint, escrow], "confirmed");
  if (!configInfo || !configInfo.owner.equals(program)) throw new SolanaBoundaryError("INVALID_CONFIG", "The program Config PDA is missing or has the wrong owner.", 503);
  assertDeploymentConfig(configInfo.data, manifest, action === "fund");
  if (!mintInfo || !mintInfo.owner.equals(tokenProgram) || mintInfo.data.length < 46 || mintInfo.data[44] !== 6 || mintInfo.data[45] !== 1) throw new SolanaBoundaryError("INVALID_USDC_MINT", "The configured mint is invalid or is not six-decimal USDC.", 503);
  if (action === "fund" && escrowInfo) throw new SolanaBoundaryError("ESCROW_ALREADY_EXISTS", "The canonical escrow already exists.", 409);
  if (action !== "fund") {
    if (!escrowInfo || !escrowInfo.owner.equals(program)) throw new SolanaBoundaryError("ESCROW_NOT_FOUND", "The canonical escrow is missing.", 409);
    const current = decodeEscrow(escrowInfo.data);
    if (current.config !== config.toBase58() || !current.contractHash.equals(contractHash) || !current.termsHash.equals(termsHash) || current.client !== client.toBase58() || current.freelancer !== freelancer.toBase58() || current.mint !== mint.toBase58() || current.grossAmount !== amount) throw new SolanaBoundaryError("ESCROW_ACCOUNT_MISMATCH", "On-chain escrow fields do not match the contract.", 409);
    if (!requiredEscrowStates[action]?.includes(current.state)) throw new SolanaBoundaryError("ESCROW_STATE_MISMATCH", `Action ${action} is unavailable while the on-chain escrow is ${current.state}.`, 409);
  }

  const expectedAccounts = Object.fromEntries(Object.entries(accounts).map(([name, value]) => [name, value.toBase58()]));
  const priorResult = await db.query<{ id: string; kind: string; contract_id: string; expires_at: string; expected_accounts: Record<string, string> }>("select id,kind,contract_id,expires_at,expected_accounts from chain_actions where actor_id=$1 and idempotency_key=$2", [actor.id, idempotencyKey]);
  const prior = priorResult.rows[0];
  let actionId = prior?.id;
  let expiresAt = prior?.expires_at;
  if (prior) {
    if (prior.kind !== action || prior.contract_id !== contract.id || JSON.stringify(prior.expected_accounts) !== JSON.stringify(expectedAccounts)) throw new SolanaBoundaryError("IDEMPOTENCY_CONFLICT", "Idempotency key was already used for different inputs.", 409);
    if (new Date(prior.expires_at).getTime() <= Date.now()) throw new SolanaBoundaryError("CHAIN_ACTION_EXPIRED", "The existing chain action expired.", 409);
  } else {
    actionId = randomUUID(); expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    await db.query(`insert into chain_actions (id,action_key,idempotency_key,kind,contract_id,actor_id,cluster,program_id,mint,token_program_id,escrow_pda,amount_atomic,terms_hash,expected_accounts,expires_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [actionId, `${contract.id}:${action}:${String(contract.version)}`, idempotencyKey, action, contract.id, actor.id, manifest.cluster, manifest.programId, manifest.usdcMint, manifest.tokenProgramId, escrow.toBase58(), amount.toString(), termsHash, expectedAccounts, expiresAt]);
  }
  if (!actionId || !expiresAt) throw new SolanaBoundaryError("CHAIN_ACTION_STORE_FAILED", "Chain action identifier is missing.", 503);

  const latest = await rpc.getLatestBlockhash("confirmed");
  const instruction = buildEscrowInstruction(action, program, accounts, contractHash, termsHash, amount);
  const transaction = new Transaction({ feePayer: actorKey, recentBlockhash: latest.blockhash }).add(instruction);
  return { action: { id: actionId, kind: action, status: "created", contractId: contract.id, cluster: manifest.cluster, programId: manifest.programId, mint: manifest.usdcMint, escrowPda: escrow.toBase58(), amountAtomic: amount.toString(), termsHashHex: termsHash.toString("hex"), expectedAccounts, expiresAt }, transactionBase64: transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"), recentBlockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight, feePayer: actorKey.toBase58() };
}
