"use client";

import { useState } from "react";
import { TransactionStatus } from "genlayer-js/types";
import { getWalletClient, getReadClient, CONTRACT_ADDRESS } from "@/lib/genlayer-browser-client";
import { useWallet } from "@/lib/useWallet";

type FormState = "idle" | "loading" | "success" | "error";

function GenLayerMark() {
  // Placeholder mark — swap for the official SVG from genlayer.com/brand
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2L26 24H2L14 2Z" stroke="#2DD8C5" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 12L19 22H9L14 12Z" fill="#2DD8C5" />
    </svg>
  );
}

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const inputClass =
  "w-full bg-[#0F1620] border border-[#232C38] rounded-lg px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#2DD8C5] focus:border-[#2DD8C5] transition disabled:opacity-40";

export default function Home() {
  const { address, connecting, error: walletError, connect } = useWallet();

  // --- Create bounty ---
  const [repoUrl, setRepoUrl] = useState("");
  const [issueUrl, setIssueUrl] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [severityCriteria, setSeverityCriteria] = useState(
    "critical = security issue, high = broken core feature, medium = missing documentation, low = typo or cosmetic issue"
  );
  const [amount, setAmount] = useState("1000");
  const [createState, setCreateState] = useState<FormState>("idle");
  const [createError, setCreateError] = useState<string | null>(null);
  const [lastBountyId, setLastBountyId] = useState<string | null>(null);

  // --- Submit fix ---
  const [bountyIdInput, setBountyIdInput] = useState("");
  const [prUrl, setPrUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitState, setSubmitState] = useState<FormState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // --- Request / view judgment ---
  const [judgeBountyId, setJudgeBountyId] = useState("");
  const [judgeState, setJudgeState] = useState<FormState>("idle");
  const [judgeError, setJudgeError] = useState<string | null>(null);
  const [bountyData, setBountyData] = useState<any>(null);

  const requireWallet = () => {
    if (!address) {
      throw new Error("Connect your wallet first.");
    }
    return address;
  };

  const createBounty = async () => {
    setCreateState("loading");
    setCreateError(null);
    try {
      const acct = requireWallet();
      const client = getWalletClient(acct);

      const txHash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "create_bounty",
        args: [repoUrl, issueUrl, issueDescription, severityCriteria, Number(amount)],
        value: 0n,
      });
      const receipt = await client.waitForTransactionReceipt({
        hash: txHash,
        status: TransactionStatus.FINALIZED,
        retries: 100,
        interval: 3000,
      });

      const returned = (receipt as any)?.data ?? receipt;
      const id = typeof returned === "string" ? returned : JSON.stringify(returned);
      setLastBountyId(id);
      setCreateState("success");
    } catch (err: any) {
      setCreateError(err.message);
      setCreateState("error");
    }
  };

  const submitFix = async () => {
    setSubmitState("loading");
    setSubmitError(null);
    try {
      const acct = requireWallet();
      const client = getWalletClient(acct);

      const txHash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "submit_fix",
        args: [bountyIdInput, prUrl, notes || ""],
        value: 0n,
      });
      await client.waitForTransactionReceipt({
        hash: txHash,
        status: TransactionStatus.FINALIZED,
        retries: 100,
        interval: 3000,
      });
      setSubmitState("success");
    } catch (err: any) {
      setSubmitError(err.message);
      setSubmitState("error");
    }
  };

  const requestJudgment = async () => {
    setJudgeState("loading");
    setJudgeError(null);
    setBountyData(null);
    try {
      const acct = requireWallet();
      const client = getWalletClient(acct);

      const txHash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "request_judgment",
        args: [judgeBountyId],
        value: 0n,
      });
      await client.waitForTransactionReceipt({
        hash: txHash,
        status: TransactionStatus.FINALIZED,
        retries: 150,
        interval: 4000,
      });
      await viewBounty();
      setJudgeState("success");
    } catch (err: any) {
      setJudgeError(err.message);
      setJudgeState("error");
    }
  };

  const viewBounty = async () => {
    try {
      const client = getReadClient();
      const bounty = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_bounty",
        args: [judgeBountyId],
      });
      let judgment = null;
      try {
        judgment = await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_judgment",
          args: [judgeBountyId],
        });
      } catch {
        // No judgment yet — normal until request_judgment has been called
      }
      setBountyData({ bounty, judgment });
    } catch (err: any) {
      setJudgeError(err.message);
    }
  };

  return (
    <main className="min-h-screen bg-[#0A0E12] text-gray-100">
      {/* Nav */}
      <header className="border-b border-[#161D26]">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-2">
          <GenLayerMark />
          <span className="font-semibold tracking-tight text-gray-100">BugBounty</span>
          <span className="text-[#2DD8C5] font-semibold">.ai</span>
          <span className="ml-auto flex items-center gap-3">
            <span className="text-xs text-gray-500 hidden sm:block">Built on GenLayer</span>
            {address ? (
              <span className="text-xs font-mono bg-[#0F1620] border border-[#232C38] text-[#2DD8C5] rounded-full px-3 py-1.5">
                {shortenAddress(address)}
              </span>
            ) : (
              <button
                onClick={connect}
                disabled={connecting}
                className="text-xs font-medium bg-[#2DD8C5] text-[#06201C] rounded-full px-4 py-1.5 hover:bg-[#4FE3D3] disabled:opacity-50 transition"
              >
                {connecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </span>
        </div>
        {walletError && (
          <div className="max-w-5xl mx-auto px-6 pb-3 text-xs text-red-400">{walletError}</div>
        )}
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-14 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#232C38] bg-[#0F1620] px-3 py-1 text-xs text-gray-400 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2DD8C5]" />
          Deployed on GenLayer
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          Bug bounties,
          <br />
          <span className="text-[#2DD8C5]">judged by AI.</span>
        </h1>
        <p className="mt-5 text-gray-400 max-w-xl mx-auto text-sm sm:text-base">
          Maintainers post a bounty tied to an issue. Hunters submit a fix.
          An AI agent reads the real pull request on GitHub, verifies it
          resolves the bug, and releases payment on-chain — no manual review.
        </p>
        {!address && (
          <button
            onClick={connect}
            disabled={connecting}
            className="mt-7 bg-[#2DD8C5] text-[#06201C] font-medium px-6 py-3 rounded-lg hover:bg-[#4FE3D3] disabled:opacity-50 transition"
          >
            {connecting ? "Connecting..." : "Connect Wallet to start"}
          </button>
        )}
      </section>

      {/* App */}
      <section className="max-w-2xl mx-auto px-6 pb-24 space-y-6">
        {/* 1. Create bounty */}
        <div className="bg-[#0F1620] border border-[#1B232E] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xs font-mono text-[#2DD8C5] bg-[#0A2E29] rounded px-2 py-0.5">01</span>
            <h2 className="text-base font-semibold text-gray-100">Post a bounty</h2>
          </div>
          <div className="space-y-3">
            <input className={inputClass} placeholder="Repository URL" disabled={!address}
              value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
            <input className={inputClass} placeholder="Issue URL" disabled={!address}
              value={issueUrl} onChange={(e) => setIssueUrl(e.target.value)} />
            <textarea className={inputClass} rows={2} placeholder="Describe the bug" disabled={!address}
              value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} />
            <textarea className={inputClass} rows={2} placeholder="Severity criteria (used by the AI judge)" disabled={!address}
              value={severityCriteria} onChange={(e) => setSeverityCriteria(e.target.value)} />
            <input className={inputClass} type="number" placeholder="Amount" disabled={!address}
              value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button onClick={createBounty} disabled={createState === "loading" || !address}
              className="w-full bg-[#2DD8C5] text-[#06201C] font-medium px-4 py-2.5 rounded-lg hover:bg-[#4FE3D3] disabled:opacity-50 transition">
              {!address ? "Connect wallet to post" : createState === "loading" ? "Posting..." : "Post bounty"}
            </button>
            {createState === "error" && createError && <p className="mt-1 text-sm text-red-400">⚠ {createError}</p>}
            {createState === "success" && lastBountyId && (
              <p className="mt-1 text-sm text-[#2DD8C5]">✓ Bounty created: {lastBountyId}</p>
            )}
          </div>
        </div>

        {/* 2. Submit fix */}
        <div className="bg-[#0F1620] border border-[#1B232E] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xs font-mono text-[#2DD8C5] bg-[#0A2E29] rounded px-2 py-0.5">02</span>
            <h2 className="text-base font-semibold text-gray-100">Submit a fix</h2>
          </div>
          <div className="space-y-3">
            <input className={inputClass} placeholder="Bounty ID (e.g. bounty_0)" disabled={!address}
              value={bountyIdInput} onChange={(e) => setBountyIdInput(e.target.value)} />
            <input className={inputClass} placeholder="Pull request URL" disabled={!address}
              value={prUrl} onChange={(e) => setPrUrl(e.target.value)} />
            <textarea className={inputClass} rows={2} placeholder="Notes (optional)" disabled={!address}
              value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button onClick={submitFix} disabled={submitState === "loading" || !address}
              className="w-full bg-[#161D26] border border-[#232C38] text-gray-100 font-medium px-4 py-2.5 rounded-lg hover:border-[#2DD8C5] disabled:opacity-50 transition">
              {!address ? "Connect wallet to submit" : submitState === "loading" ? "Submitting..." : "Submit pull request"}
            </button>
            {submitState === "error" && submitError && <p className="mt-1 text-sm text-red-400">⚠ {submitError}</p>}
            {submitState === "success" && <p className="mt-1 text-sm text-[#2DD8C5]">✓ Pull request submitted</p>}
          </div>
        </div>

        {/* 3. Judgment */}
        <div className="bg-[#0F1620] border border-[#1B232E] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xs font-mono text-[#2DD8C5] bg-[#0A2E29] rounded px-2 py-0.5">03</span>
            <h2 className="text-base font-semibold text-gray-100">AI judgment</h2>
          </div>
          <div className="space-y-3">
            <input className={inputClass} placeholder="Bounty ID (e.g. bounty_0)"
              value={judgeBountyId} onChange={(e) => setJudgeBountyId(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={requestJudgment} disabled={judgeState === "loading" || !address}
                className="flex-1 bg-[#2DD8C5] text-[#06201C] font-medium px-4 py-2.5 rounded-lg hover:bg-[#4FE3D3] disabled:opacity-50 transition">
                {!address ? "Connect wallet" : judgeState === "loading" ? "Judging..." : "Request judgment"}
              </button>
              <button onClick={viewBounty}
                className="bg-[#161D26] border border-[#232C38] text-gray-300 px-4 py-2.5 rounded-lg hover:border-[#2DD8C5] transition text-sm">
                View status
              </button>
            </div>
            {judgeState === "error" && judgeError && (
              <p className="text-sm text-red-400">⚠ {judgeError}</p>
            )}
            {bountyData && (
              <pre className="bg-[#0A0E12] border border-[#1B232E] rounded-lg p-4 text-xs text-gray-400 overflow-auto">
                {JSON.stringify(bountyData, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-[#161D26] py-6 text-center text-xs text-gray-600">
        BugBounty — an Intelligent Contract on GenLayer
      </footer>
    </main>
  );
}