export type ProjectSummary = {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  status: string;
  skills: string[];
  budgetAtomic: string;
  budgetUsdc: string;
  deliveryDays: number;
  proposals: number;
  postedAt: string;
  createdAt: string;
  clientId: string;
  client: { name: string; location: string; projectsFunded: number; wallet: string };
};

export type FreelancerProfile = {
  id: string;
  name: string;
  headline: string;
  bio: string;
  location: string;
  rateUsdc: string;
  availability: string;
  skills: string[];
  completedContracts: number;
  earnedUsdc: string;
  wallet: string;
  portfolio: { label: string; url: string }[];
};

export type ProposalSummary = {
  id: string;
  projectId: string;
  projectTitle: string;
  freelancer: { id: string; name: string; headline: string; completedContracts: number };
  amountAtomic: string;
  amountUsdc: string;
  deliveryDays: number;
  coverLetter: string;
  portfolioUrl: string | null;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  createdAt: string;
  contractId: string | null;
};

export type ContractSummary = {
  id: string;
  projectId: string;
  projectTitle: string;
  status: string;
  amountAtomic: string;
  amountUsdc: string;
  counterpart: string;
  role: "client" | "freelancer";
  updatedAt: string;
};

export type ContractDetail = ContractSummary & {
  feeAtomic: string;
  currencyMint: string;
  termsHash: string;
  escrowPda: string | null;
  client: { id: string; name: string; wallet: string };
  freelancer: { id: string; name: string; wallet: string };
  conversationId: string | null;
  description: string;
  deliveryDays: number;
  disputeId: string | null;
  createdAt: string;
};

export type Viewer = { authenticated: boolean; walletAddress?: string; profileId?: string; displayName?: string; roles: string[] };
