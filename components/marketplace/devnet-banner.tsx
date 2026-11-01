export function DevnetBanner() {
  return (
    <div className="devnetBanner" role="note">
      <div><i aria-hidden="true" /><span>Running on Solana devnet with Mock USDC. The escrow program is unaudited — do not use real funds.</span></div>
    </div>
  );
}
