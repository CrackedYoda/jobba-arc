import Link from "next/link";

import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="siteFooter">
      <div className="shell">
        <Logo onDark />
        <nav aria-label="Footer">
          <Link href="/projects">Find work</Link>
          <Link href="/freelancers">Find talent</Link>
          <Link href="/projects/new">Post a project</Link>
          <Link href="/connect">Connect wallet</Link>
        </nav>
        <small>Devnet build. Settlement in USDC; SOL pays network fees. Unaudited program — test funds only.</small>
      </div>
    </footer>
  );
}
