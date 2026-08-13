// lib/useWallet.ts
"use client";

import { useCallback, useState } from "react";

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setError(null);
    const eth = (window as any).ethereum;
    if (!eth) {
      setError("No wallet found. Install MetaMask to continue.");
      return;
    }
    setConnecting(true);
    try {
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      setAddress(accounts[0]);
    } catch (err: any) {
      setError(err?.message || "Wallet connection was rejected.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  return { address, connecting, error, connect, disconnect };
}