import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { getServerEnv } from "@/lib/config/env";
import { getDatabase, hasDatabase, type Database } from "@/server/db/client";

export type StoredChallenge = { address: string; message: string; expiresAt: number; consumedAt?: number };
export type StoredSession = { walletAddress: string; expiresAt: number };
type AuthState = { challenges: Map<string, StoredChallenge>; sessions: Map<string, StoredSession> };

declare global { var __jobbaAuthState: AuthState | undefined; }

const memory = globalThis.__jobbaAuthState ?? {
  challenges: new Map<string, StoredChallenge>(),
  sessions: new Map<string, StoredSession>(),
};
if (process.env.NODE_ENV !== "production") globalThis.__jobbaAuthState = memory;

function digestHex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashBytes(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function database(): Database | undefined {
  if (!hasDatabase()) {
    if (getServerEnv().NODE_ENV === "production") throw new Error("Persistent SIWS storage is required in production.");
    return undefined;
  }
  return getDatabase();
}

export function createNonce(): string {
  return randomBytes(18).toString("base64url");
}

export async function saveChallenge(nonce: string, challenge: StoredChallenge): Promise<void> {
  const db = database();
  if (!db) {
    memory.challenges.set(nonce, challenge);
    return;
  }
  const env = getServerEnv();
  await db.query(
    `insert into auth_nonces (wallet_public_key, nonce_hash, message_hash, message_text, domain, uri, chain_id, issued_at, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [challenge.address, hashBytes(nonce), hashBytes(challenge.message), challenge.message, env.SIWS_DOMAIN,
      env.NEXT_PUBLIC_APP_URL, `solana:${env.NEXT_PUBLIC_SOLANA_CLUSTER}`,
      new Date(challenge.expiresAt - env.SIWS_NONCE_TTL_SECONDS * 1_000).toISOString(),
      new Date(challenge.expiresAt).toISOString()],
  );
}

export async function consumeChallenge(nonce: string, address: string, now = Date.now()): Promise<StoredChallenge | undefined> {
  const db = database();
  if (!db) {
    const challenge = memory.challenges.get(nonce);
    if (!challenge || challenge.consumedAt || challenge.address !== address || challenge.expiresAt <= now) return undefined;
    challenge.consumedAt = now;
    return challenge;
  }
  const consumedAt = new Date(now).toISOString();
  const { rows } = await db.query<{ message_text: string; expires_at: string }>(
    `update auth_nonces set consumed_at = $3
      where nonce_hash = $1 and wallet_public_key = $2 and consumed_at is null and expires_at > $3
      returning message_text, expires_at`,
    [hashBytes(nonce), address, consumedAt],
  );
  return rows[0] ? {
    address,
    message: rows[0].message_text,
    expiresAt: new Date(rows[0].expires_at).getTime(),
    consumedAt: now,
  } : undefined;
}

async function findOrCreateProfile(db: Database, walletAddress: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into profiles (wallet_public_key, display_name) values ($1, $2)
     on conflict (wallet_public_key) do update set wallet_public_key = excluded.wallet_public_key
     returning id`,
    [walletAddress, `Wallet ${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`],
  );
  const env = getServerEnv();
  const admins = new Set([...(env.ADMIN_WALLETS?.split(",") ?? []), env.SOLANA_ADMIN_WALLET ?? ""].map((value) => value.trim()).filter(Boolean));
  if (admins.has(walletAddress)) {
    await db.query("insert into profile_roles (profile_id, role) values ($1, 'admin') on conflict do nothing", [rows[0].id]);
  }
  return rows[0].id;
}

export async function createSession(walletAddress: string, ttlSeconds: number): Promise<{ token: string; session: StoredSession }> {
  const token = randomBytes(32).toString("base64url");
  const session = { walletAddress, expiresAt: Date.now() + ttlSeconds * 1_000 };
  const db = database();
  if (!db) {
    memory.sessions.set(digestHex(token), session);
    return { token, session };
  }
  const profileId = await findOrCreateProfile(db, walletAddress);
  await db.query(
    "insert into auth_sessions (profile_id, token_hash, wallet_public_key, expires_at) values ($1,$2,$3,$4)",
    [profileId, hashBytes(token), walletAddress, new Date(session.expiresAt).toISOString()],
  );
  return { token, session };
}

export async function readSession(token: string | undefined): Promise<StoredSession | undefined> {
  if (!token) return undefined;
  const db = database();
  if (!db) {
    const key = digestHex(token);
    const session = memory.sessions.get(key);
    if (!session || session.expiresAt <= Date.now()) {
      memory.sessions.delete(key);
      return undefined;
    }
    return session;
  }
  const { rows } = await db.query<{ wallet_public_key: string; expires_at: string }>(
    `select wallet_public_key, expires_at from auth_sessions
      where token_hash = $1 and revoked_at is null and expires_at > now()`,
    [hashBytes(token)],
  );
  return rows[0] ? { walletAddress: rows[0].wallet_public_key, expiresAt: new Date(rows[0].expires_at).getTime() } : undefined;
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token) return;
  const db = database();
  if (!db) {
    memory.sessions.delete(digestHex(token));
    return;
  }
  await db.query("update auth_sessions set revoked_at = now() where token_hash = $1 and revoked_at is null", [hashBytes(token)]);
}
