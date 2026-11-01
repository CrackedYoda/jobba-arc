import { NextResponse } from "next/server";

import { success } from "@/lib/api/envelope";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    success({
      status: "ok",
      service: "jobba-freelance-web",
      version: process.env.DEPLOYMENT_VERSION ?? "development",
      timestamp: new Date().toISOString(),
    }),
    { headers: { "Cache-Control": "no-store" } },
  );
}
