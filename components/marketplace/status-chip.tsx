const labels: Record<string, string> = {
  funding_pending: "Funding pending", under_review: "Under review", awaiting_chain: "Awaiting chain",
  refund_client: "Refund client", award_freelancer: "Award freelancer",
};

export function StatusChip({ status }: { status: string }) {
  const label = labels[status] ?? status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  return <span className={`chip ${status}`}><i aria-hidden="true" />{label}</span>;
}
