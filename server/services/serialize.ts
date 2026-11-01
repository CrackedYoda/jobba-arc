type Row = Record<string, unknown>;

export function serializeProject(row: Row) {
  return {
    ...row,
    budget_atomic: undefined,
    budgetAtomic: String(row.budget_atomic),
    clientId: row.client_id,
    client_id: undefined,
    currencyMint: row.currency_mint,
    currency_mint: undefined,
    publishedAt: row.published_at,
    published_at: undefined,
    createdAt: row.created_at,
    created_at: undefined,
    updatedAt: row.updated_at,
    updated_at: undefined,
    skills: Array.isArray(row.project_skills)
      ? row.project_skills.map((entry) => (entry as { skill: unknown }).skill)
      : [],
    project_skills: undefined,
  };
}

export function serializeProposal(row: Row) {
  return {
    ...row,
    projectId: row.project_id,
    project_id: undefined,
    freelancerId: row.freelancer_id,
    freelancer_id: undefined,
    coverLetter: row.cover_letter,
    cover_letter: undefined,
    amount_atomic: undefined,
    amountAtomic: String(row.amount_atomic),
    estimatedDays: row.estimated_days,
    estimated_days: undefined,
    createdAt: row.created_at,
    created_at: undefined,
    updatedAt: row.updated_at,
    updated_at: undefined,
  };
}

export function serializeContract(row: Row) {
  return {
    ...row,
    projectId: row.project_id,
    project_id: undefined,
    proposalId: row.proposal_id,
    proposal_id: undefined,
    clientId: row.client_id,
    client_id: undefined,
    freelancerId: row.freelancer_id,
    freelancer_id: undefined,
    amountAtomic: String(row.amount_atomic),
    amount_atomic: undefined,
    feeAtomic: String(row.fee_atomic),
    fee_atomic: undefined,
    currencyMint: row.currency_mint,
    currency_mint: undefined,
    termsHash: row.terms_hash,
    terms_hash: undefined,
    escrowPda: row.escrow_pda,
    escrow_pda: undefined,
    createdAt: row.created_at,
    created_at: undefined,
    updatedAt: row.updated_at,
    updated_at: undefined,
  };
}
