import type { EscrowAction } from "@/lib/solana/types";

export type FinalizationProjection = {
  contractStatus: "funded" | "active" | "submitted" | "released" | "cancelled" | "disputed" | "resolved";
  projectStatus: "contracted" | "completed" | "cancelled" | "disputed" | null;
  resolvesDispute: boolean;
};

const projections: Record<EscrowAction, FinalizationProjection> = {
  fund: { contractStatus: "funded", projectStatus: "contracted", resolvesDispute: false },
  accept: { contractStatus: "active", projectStatus: null, resolvesDispute: false },
  submit: { contractStatus: "submitted", projectStatus: null, resolvesDispute: false },
  release: { contractStatus: "released", projectStatus: "completed", resolvesDispute: false },
  cancel: { contractStatus: "cancelled", projectStatus: "cancelled", resolvesDispute: false },
  open_dispute: { contractStatus: "disputed", projectStatus: "disputed", resolvesDispute: false },
  refund: { contractStatus: "resolved", projectStatus: "cancelled", resolvesDispute: true },
  award: { contractStatus: "resolved", projectStatus: "completed", resolvesDispute: true },
};

export function getFinalizationProjection(kind: string): FinalizationProjection {
  const projection = projections[kind as EscrowAction];
  if (!projection) throw new Error(`Unsupported chain action kind: ${kind}`);
  return projection;
}
