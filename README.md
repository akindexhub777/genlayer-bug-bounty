# BugBounty — AI-Judged Bug Bounties on GenLayer

BugBounty lets any open-source maintainer post a bounty tied to a GitHub
issue. A hunter submits a fix as a pull request, and an **Intelligent
Contract** reads the real PR from GitHub, verifies it actually resolves the
reported bug, scores its severity against the maintainer's own criteria, and
releases the matching payment — with no human reviewer in the loop.

## The problem

Bug bounty payouts today are almost always manually reviewed: a maintainer
has to read every submitted fix, decide if it's valid, judge how severe the
bug was, and trigger payment by hand. That's slow, inconsistent between
maintainers, and doesn't scale for small open-source projects that don't
have a security team.

## The solution

BugBounty moves that judgment on-chain, using GenLayer's Intelligent
Contracts to combine two things a normal smart contract can't do on its own:

1. **Read the real world.** The contract calls `gl.nondet.web.render()` to
   fetch the actual content of the submitted GitHub pull request — not a
   URL string, the real page.
2. **Reason about it.** The fetched PR content, the original issue
   description, and the maintainer's own severity criteria (free text, e.g.
   *"critical = security issue, low = typo"*) are passed to an LLM via
   `gl.nondet.exec_prompt()`. The model decides whether the PR genuinely
   fixes the bug, and — only if accepted — scores its severity.
3. **Pay accordingly.** The payout is a percentage of the bounty amount
   based on severity (25% low → 100% critical), computed deterministically
   from the model's structured JSON output. Non-accepted decisions
   (`rejected`, `duplicate`, `needs_revision`) pay nothing.

Every judgment call runs through GenLayer's optimistic-democracy consensus
(`gl.vm.run_nondet_unsafe` with a validator function), so a single dishonest
or hallucinating validator can't unilaterally decide a payout.

## How it works

1. **Post a bounty** — maintainer provides the repo URL, issue URL, a plain
   description of the bug, their own severity criteria, and the bounty
   amount.
2. **Submit a fix** — a hunter submits their pull request URL against a
   bounty.
3. **Request judgment** — anyone can trigger the judgment call. The
   contract fetches the PR, runs the AI judge, records the decision,
   severity, reasoning, and computed payout.

All three actions are signed directly from the user's own wallet in the
browser (no backend holds funds or private keys) — each maintainer and each
hunter interacts with the contract as themselves.

## Contract

`contracts/bug_bounty.py` — a GenLayer Intelligent Contract written in
Python. Key design points:

- Storage uses `TreeMap` with `@allow_storage @dataclass` records
  (`Bounty`, `Report`, `Judgment`) rather than raw dicts, as required by
  GenVM's storage typing.
- `request_judgment()` combines a web fetch and an LLM call inside a single
  non-deterministic block, validated by `run_nondet_unsafe`, so the
  judgment is reached through consensus rather than a single node's output.
- `_calculate_paid_amount()` is fully deterministic given the model's
  `decision` and `severity` output — the payout logic itself isn't left to
  the LLM, only the judgment inputs are.

## Frontend

Next.js (App Router) + TypeScript + Tailwind, using `genlayer-js` for all
contract interaction. Wallet connection uses the browser's injected
provider (MetaMask or compatible) — `createClient` is given the connected
address only, and the wallet handles signing for every write call.

## Getting started

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourDeployedContractAddress
NEXT_PUBLIC_GENLAYER_NETWORK=studionet   # or testnetAsimov
```

```bash
npm run dev
```

Deploy `contracts/bug_bounty.py` via [GenLayer Studio](https://studio.genlayer.com)
or the GenLayer CLI before connecting the frontend to it.

## Tech stack

- GenLayer Intelligent Contracts (Python / GenVM)
- `gl.nondet.web.render`, `gl.nondet.exec_prompt`, `gl.vm.run_nondet_unsafe`
- `genlayer-js` SDK
- Next.js, TypeScript, Tailwind CSS
- MetaMask / injected EVM wallet for client-side signing

## License

MIT
