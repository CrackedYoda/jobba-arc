export type SignInChallenge = {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  chainId: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
};

export function buildSignInMessage(challenge: SignInChallenge): string {
  return [
    `${challenge.domain} wants you to sign in with your Solana account:`,
    challenge.address,
    "",
    challenge.statement,
    "",
    `URI: ${challenge.uri}`,
    "Version: 1",
    `Chain ID: ${challenge.chainId}`,
    `Nonce: ${challenge.nonce}`,
    `Issued At: ${challenge.issuedAt}`,
    `Expiration Time: ${challenge.expirationTime}`,
  ].join("\n");
}
