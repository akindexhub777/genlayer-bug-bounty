// lib/genlayer-browser-client.ts
// Ce fichier est importé côté NAVIGATEUR (composants "use client").
// Contrairement à lib/genlayer-client.ts, il ne manipule aucune clé privée :
// on donne juste l'adresse du wallet connecté, et MetaMask (ou équivalent)
// signe chaque transaction lui-même.

import { createClient } from "genlayer-js";
import { studionet, testnetAsimov } from "genlayer-js/chains";

const CHAIN =
  process.env.NEXT_PUBLIC_GENLAYER_NETWORK === "testnetAsimov" ? testnetAsimov : studionet;

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

export function getWalletClient(address: string) {
  return createClient({
    chain: CHAIN,
    account: address as `0x${string}`, // adresse seule -> le wallet gère la signature
  });
}

export function getReadClient() {
  return createClient({ chain: CHAIN });
}