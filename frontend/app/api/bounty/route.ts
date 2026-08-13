import { NextResponse } from "next/server";
import { getReadClient, CONTRACT_ADDRESS } from "@/lib/genlayer-client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bountyId = searchParams.get("bounty_id");

  if (!bountyId) {
    return NextResponse.json({ error: "bounty_id manquant" }, { status: 400 });
  }

  const client = getReadClient();

  try {
    const bounty = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_bounty",
      args: [bountyId],
    });

    let judgment = null;
    try {
      judgment = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_judgment",
        args: [bountyId],
      });
    } catch {
      // Pas encore de jugement, c'est normal tant que request_judgment n'a pas été appelé
    }

    return NextResponse.json({ bounty, judgment });
  } catch (err: any) {
    console.error("get bounty error:", err);
    return NextResponse.json({ error: err?.message || "Bounty introuvable" }, { status: 404 });
  }
}