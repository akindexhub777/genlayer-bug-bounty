# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
import typing

# ---------------------------------------------------------------------------
# BugBounty : le mainteneur d'un repo publie un bounty lié à une issue.
# Un chasseur soumet le lien de sa Pull Request.
# Le contrat lit la PR sur GitHub (gl.nondet.web.render) et demande à l'IA
# de juger si elle corrige bien le bug décrit, puis d'attribuer un niveau
# de sévérité qui détermine le pourcentage du bounty payé.
# ---------------------------------------------------------------------------


@allow_storage
@dataclass
class Bounty:
    id: str
    maintainer: Address
    repo_url: str
    issue_url: str
    issue_description: str
    severity_criteria: str
    amount: u256
    status: str  # "open", "submitted", "judging", "closed"


@allow_storage
@dataclass
class Report:
    id: str
    bounty_id: str
    hunter: Address
    pr_url: str
    notes: str


@allow_storage
@dataclass
class Judgment:
    bounty_id: str
    decision: str  # "accepted", "rejected", "duplicate", "needs_revision"
    severity: str  # "low", "medium", "high", "critical", "none"
    reasoning: str
    paid_amount: u256


class BugBounty(gl.Contract):
    bounties: TreeMap[str, Bounty]
    reports: TreeMap[str, Report]
    # Un seul jugement retenu par bounty -> indexé directement par bounty_id.
    judgments: TreeMap[str, Judgment]

    bounty_count: u32
    report_count: u32

    def __init__(self):
        # Storage zero-initialisé automatiquement par GenVM, ne rien
        # réassigner ici (voir notes précédentes sur TreeMap()).
        pass

    # -----------------------------------------------------------------
    # Écritures
    # -----------------------------------------------------------------

    @gl.public.write
    def create_bounty(
        self,
        repo_url: str,
        issue_url: str,
        issue_description: str,
        severity_criteria: str,
        amount: int,
    ) -> str:
        bounty_id = f"bounty_{int(self.bounty_count)}"
        self.bounty_count = u32(int(self.bounty_count) + 1)

        self.bounties[bounty_id] = Bounty(
            id=bounty_id,
            maintainer=gl.message.sender_address,
            repo_url=repo_url,
            issue_url=issue_url,
            issue_description=issue_description,
            severity_criteria=severity_criteria,
            amount=u256(amount),
            status="open",
        )
        return bounty_id

    @gl.public.write
    def submit_fix(self, bounty_id: str, pr_url: str, notes: str) -> str:
        if bounty_id not in self.bounties:
            raise gl.vm.UserError("bounty not found")
        b = self.bounties[bounty_id]
        if b.status != "open":
            raise gl.vm.UserError("bounty is not open for submissions")

        report_id = f"report_{int(self.report_count)}"
        self.report_count = u32(int(self.report_count) + 1)

        self.reports[report_id] = Report(
            id=report_id,
            bounty_id=bounty_id,
            hunter=gl.message.sender_address,
            pr_url=pr_url,
            notes=notes,
        )
        b.status = "submitted"
        self.bounties[bounty_id] = b
        return report_id

    @gl.public.write
    def request_judgment(self, bounty_id: str) -> str:
        if bounty_id not in self.bounties:
            raise gl.vm.UserError("bounty not found")
        b = self.bounties[bounty_id]
        if b.status != "submitted":
            raise gl.vm.UserError("bounty has no pending submission")
        b.status = "judging"
        self.bounties[bounty_id] = b
        return self._run_judgment(bounty_id)

    def _run_judgment(self, bounty_id: str) -> str:
        b = self.bounties[bounty_id]

        report = None
        for r in self.reports.values():
            if r.bounty_id == bounty_id:
                report = r
                break
        if report is None:
            raise gl.vm.UserError("no report for this bounty")

        def leader_fn():
            # Lecture de la PR directement depuis GitHub (mode "text" pour
            # éviter de charger tout le HTML brut).
            pr_content = gl.nondet.web.render(report.pr_url, mode="text")

            prompt = f"""
You are a bug bounty judge evaluating a Pull Request against a reported issue.

Repository: {b.repo_url}
Issue: {b.issue_url}
Issue description:
{b.issue_description}

Severity criteria provided by the maintainer:
{b.severity_criteria}

Pull Request content (fetched from GitHub):
{pr_content[:4000]}

Hunter's notes:
{report.notes}

Your task:
1. Decide if this PR genuinely fixes the described issue. Choose one:
   "accepted" (clearly fixes it), "rejected" (does not address it),
   "duplicate" (fixes something already fixed elsewhere / not a real bug),
   "needs_revision" (partial fix, missing edge cases).
2. If accepted, estimate severity using the maintainer's criteria above:
   "low", "medium", "high", "critical". If not accepted, use "none".
3. Explain your reasoning briefly.

Respond ONLY with a JSON object with keys:
- decision (string)
- severity (string)
- reasoning (string)
"""
            return gl.nondet.exec_prompt(prompt, response_format="json")

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            data = leader_result.calldata
            if not isinstance(data, dict):
                return False
            required_keys = {"decision", "severity", "reasoning"}
            return required_keys.issubset(data.keys())

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        decision = str(result.get("decision", "rejected"))
        severity = str(result.get("severity", "none"))
        reasoning = str(result.get("reasoning", ""))

        paid_amount = self._calculate_paid_amount(b, decision, severity)

        self.judgments[bounty_id] = Judgment(
            bounty_id=bounty_id,
            decision=decision,
            severity=severity,
            reasoning=reasoning,
            paid_amount=u256(paid_amount),
        )

        b.status = "closed"
        self.bounties[bounty_id] = b

        return bounty_id

    def _calculate_paid_amount(
        self, bounty: Bounty, decision: str, severity: str
    ) -> int:
        if decision != "accepted":
            return 0
        amount = int(bounty.amount)
        ratios = {
            "critical": 1.0,
            "high": 0.75,
            "medium": 0.5,
            "low": 0.25,
        }
        return int(amount * ratios.get(severity, 0.25))

    # -----------------------------------------------------------------
    # Lectures
    # -----------------------------------------------------------------

    @gl.public.view
    def get_bounty(self, bounty_id: str) -> TreeMap[str, typing.Any]:
        if bounty_id not in self.bounties:
            raise gl.vm.UserError("bounty not found")
        return self.bounties[bounty_id]

    @gl.public.view
    def get_judgment(self, bounty_id: str) -> TreeMap[str, typing.Any]:
        if bounty_id not in self.judgments:
            raise gl.vm.UserError("no judgment for this bounty")
        return self.judgments[bounty_id]