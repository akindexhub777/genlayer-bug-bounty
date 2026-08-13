import { NextResponse } from "next/server";
import { TransactionStatus } from "genlayer-js/types";
import { getServerClient, CONTRACT_ADDRESS } from "@/lib/genlayer-client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { bounty_id } = body;

    if (!bounty_id) {
      return NextResponse.json({ error: "bounty_id manquant" }, { status: 400 });
    }

    const client = getServerClient();

    const txHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "request_judgment",
      args: [bounty_id],
      value: 0,
    });

    // Cet appel peut prendre plus longtemps (lecture web + IA côté validateurs)
    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      status: TransactionStatus.FINALIZED,
      retries: 150,
      interval: 4000,
    });

    return NextResponse.json({ txHash, receipt });
  } catch (err: any) {
    console.error("request-judgment error:", err);
    return NextResponse.json({ error: err?.message || "Erreur inconnue" }, { status: 500 });
  }
}