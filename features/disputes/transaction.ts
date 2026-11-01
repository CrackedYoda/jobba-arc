import type { Provider } from "@reown/appkit-adapter-solana/react";
import { Transaction } from "@solana/web3.js";
import type { UnsignedEscrowTransaction } from "@/lib/solana/types";

async function responseBody(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "The transaction request failed.");
  return body;
}

export async function signConfirmAndFinalize(prepared: UnsignedEscrowTransaction, provider: Provider, address: string) {
  if (address !== prepared.feePayer) throw new Error("Connected wallet differs from the authorized fee payer.");
  const bytes = Uint8Array.from(window.atob(prepared.transactionBase64), (character) => character.charCodeAt(0));
  const signature = await provider.signAndSendTransaction(Transaction.from(bytes));
  const confirmed = await responseBody(await fetch(`/api/v1/chain/actions/${prepared.action.id}/confirm`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signature }),
  }));
  const finalizedResponse = await fetch(`/api/v1/chain/actions/${prepared.action.id}/finalize`, { method: "POST" });
  if (!finalizedResponse.ok) return { message: `Confirmed in slot ${confirmed.data.slot}. Finalization is pending; use Retry finalization.`, signature, finalized: false };
  const finalized = await finalizedResponse.json();
  return { message: `Finalized in slot ${finalized.data.slot}.`, signature, finalized: true };
}

export async function retryFinalization(actionId: string) {
  const response = await fetch(`/api/v1/chain/actions/${actionId}/finalize`, { method: "POST" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "Finalization is still pending.");
  return `Finalized in slot ${body.data.slot}.`;
}
