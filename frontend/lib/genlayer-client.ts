// lib/genlayer-client.ts
// A importer UNIQUEMENT côté serveur (routes API). Manipule la clé privée.

import { createClient, createAccount } from "genlayer-js";
import { studionet, testnetAsimov } from "genlayer-js/chains";

const CHAIN = process.env.GENLAYER_NETWORK === "testnetAsimov" ? testnetAsimov : studionet;

export const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS as `0x${string}`;

export function getServerClient() {
  if (!process.env.GENLAYER_PRIVATE_KEY) {
    throw new Error("GENLAYER_PRIVATE_KEY manquant dans les variables d'environnement");
  }
  const account = createAccount(process.env.GENLAYER_PRIVATE_KEY as `0x${string}`);
  return createClient({
    chain: CHAIN,
    account,
  });
}

// Client en lecture seule (pas besoin de compte pour les vues)
export function getReadClient() {
  return createClient({ chain: CHAIN });
}