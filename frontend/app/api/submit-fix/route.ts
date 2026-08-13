import { NextResponse } from "next/server";
import { TransactionStatus } from "genlayer-js/types";
import { getServerClient, CONTRACT_ADDRESS } from "@/lib/genlayer-client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { bounty_id, pr_url, notes } = body;

    if (!bounty_id || !pr_url) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }

    const client = getServerClient();

    const txHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "submit_fix",
      args: [bounty_id, pr_url, notes || ""],
      value: 0,
    });

    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      status: TransactionStatus.FINALIZED,
      retries: 100,
      interval: 3000,
    });

    return NextResponse.json({ txHash, receipt });
  } catch (err: any) {
    console.error("submit-fix error:", err);
    return NextResponse.json({ error: err?.message || "Erreur inconnue" }, { status: 500 });
  }
}