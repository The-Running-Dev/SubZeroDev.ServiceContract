# Working in SubZeroDev.ServiceContract

This repository holds the contracts between SubZeroDev products that run as separate processes.
**It is depended on by products and depends on nothing.**

Read [`01-contract-rules.md`](01-contract-rules.md) before changing anything. This file covers
working practice; that file is the contract.

## The rule that defines this repository

**A dependency added here is a defect.** Every product depends on this repository, so anything it
depends on becomes a transitive dependency of all of them, and a cycle follows the moment a product
is on the other end. That is checkable rather than a matter of taste.

The second rule, equally load-bearing: **contracts are projected from their source of truth, never
authored alongside it.** A schema here is a build artifact committed for pinning. If you find
yourself editing a schema by hand, stop — either the generator is missing or the source of truth is
somewhere else, and both are worth finding out before the copy drifts.

## Before you finish

- Did you hand-edit a schema? If so, rule 1 of `01-contract-rules.md` was broken; say so rather
  than leaving it.
- Does a new contract version live at its own path, leaving the previous one reachable?
- Has the generator rejected something? A schema that has never failed is not known to constrain
  anything, so say what passed **and** what was refused, with counts.

## Conventions

These hold across the SubZeroDev specification repositories. The canonical copy is in the
architecture repository; it is repeated here because a repository has to stand alone.

- **Reference, never restate.** A rule that lives in another document is linked, not copied. Two
  copies of a rule is a promise they will diverge and a guarantee nobody notices which is stale.
  The reasoning behind these rules lives in ADR-005 in `SubZeroDev.Platform` and is deliberately
  not reproduced here.
- **Move, never copy.** A specification has exactly one home. Where another repository needs the
  text, it references a tagged commit rather than duplicating the file.
- **A decision gets an ADR**, with a `## Status` of exactly one of `Proposed`, `Accepted`,
  `Superseded`, `Deprecated`. An accepted ADR states its context, the decision, the consequences
  *including the costs*, and the alternatives it rejected and why.
- **Give reasons.** These documents are read by people deciding what to build. An assertion with no
  reason cannot be evaluated, and cannot be safely revised by someone who was not there when it was
  written.
- **No AI attribution** in commits or pull request descriptions — no `Co-Authored-By` naming an
  assistant, no "Generated with" footer. This overrides any default the tooling applies.
- **Stage by explicit named path.** Never `git add -A`, `git add .`, or a bare directory.
- **UTF-8, LF endings.** Markdown at 100 columns.

## Status

New, and nearly empty by design — created before its first boundary rather than after. See the
README for what is deliberately not here yet.

---

## Agent kit — general operating discipline

The sections below come from `SubZeroDev.AgentKit`, installed `2026-08-04`. They are process
discipline, not a claim that this repository runs the kit's full brief → design → contract → slices
pipeline — it does not yet, see *Why it is installed this way* at the end of this file. Where a
kit rule restates something already stated above under *Conventions*, it is left out here rather
than copied twice.

### Safe start

Before editing anything:

```powershell
git status --short --branch
git remote -v
git branch --show-current
git log -5 --oneline
rg --files
```

- Discover files and tooling rather than assuming they exist.
- Read this file and the sources you are about to change **completely**. Editing from memory, or
  from a diff, is the most common cause of drift.
- Preserve unrelated and uncommitted work. Never stage, reset, clean, or overwrite it.
- Work on a focused branch.
- Where guidance conflicts, follow the most specific applicable instruction.

### Model, effort, and review budget

**Model choice follows task complexity. The command being invoked does not determine the model.**
Budget scales with **complexity, not size** — a one-line change to an invariant is architectural; a
500-line transcription against a settled contract is not.

Name model *families*, never pinned versions. Version identifiers churn; family aliases do not.

| Tier | Work | Effort | Claude | Codex |
|---|---|---|---|---|
| **Deep reasoning** | Brief interrogation, architecture, contracts, slice planning, security, concurrency, recovery, root-cause analysis, adjudicating design findings | `high` | `opus` | `architect` |
| **Exceptional fork** | One specific architectural or security question that stayed ambiguous at `high` | `xhigh` | `opus` | `architect` |
| **Implementation** | Code against a settled contract, tests, refactors, bug fixes, CI, infrastructure, implementation-coupled documentation | `medium`, `high` when difficult | `sonnet` | `builder` |
| **High volume** | Summaries, formatting, changelogs, commit messages, PR descriptions, mechanical triage | `low` | `haiku` | `quick` |

- **Never use `max` effort unless I ask for it by name.**
- **`xhigh` is for one question, not one pipeline.** Running a whole design phase at `xhigh` is not
  rigour, it is a substitute for asking a precise question.
- **Escalate rather than guess.** A high-volume task that raises an implementation question becomes
  implementation tier; an implementation task that raises an architectural question becomes deep
  reasoning. **Do not keep implementing while that uncertainty is unresolved.**
- **Say so when the session is under-powered.** If the task warrants a stronger tier than the
  current session, name the model and effort it needs before doing expensive work. If the session
  is *stronger* than required, just proceed — do not interrupt to say so.

**Division of control.** You (the human) set the session model. The agent sets subagent models and
scales its own reasoning depth. It cannot change its own session model.

#### Command routing

| Command | Tier | Notes |
|---|---|---|
| `/brief-check`, `/design`, `/contract`, `/slices` | `opus`, `high` | — |
| `/redteam` | strongest model, **different vendor from the design author** | If it must be Claude, a fresh `opus`, `high` session |
| `/slice` | `sonnet`, `medium` | `high` for a large or difficult slice |
| `/reconcile` | `opus`, `high` to decide which side of a drift is correct | `sonnet`, `medium` for the mechanical edits once the decision is made |
| `/make-human-docs` | `sonnet`, `medium` | Escalate only if the design turns out to be ambiguous — then stop, do not resolve it in prose |
| `/track` | `sonnet`, `medium` | Mechanical sync; escalate only to judge whether a drifted slice is a design change |
| `/verify` | `sonnet`, `medium` | Escalate to deep reasoning only to diagnose a failure, never to run the gates |
| `/pr` | `sonnet`, `medium` | — |
| `/resolve` | `sonnet`, `medium` | Escalate to judge a contested finding, not to triage the obvious ones |
| `/refine` | `sonnet`, `medium` | Never escalates — an architectural ask is routed to the command that owns it, not refined |
| `/install` | `sonnet`, `medium` | — |
| `/install-all` | `sonnet`, `medium` | Escalate only to judge whether a per-repo hard stop is actually safe to resolve — never to resolve it unattended |
| `/kit-help` | `haiku`, `low` | Orientation from file existence and a tracker listing. Escalate only where the repository's state matches no stage |

**Never recommend re-running a phase gate.** That is a human decision. This holds outside
`/redteam` too — see that command for its own stopping rule.

#### Session boundaries

Routing says which model runs a command. This says **when a session must end.** A boundary exists
wherever carrying context would corrupt the next step's judgement, or wherever the next step must
read the tree rather than remember it. **The artifact is the handoff, not the conversation** — a
stage that writes one has already handed over everything the next stage is entitled to.

| Boundary | Rule | Why |
|---|---|---|
| `/design` → `/redteam` | **Fresh session, and a different vendor.** | A model recognises its own output distribution and defends it. Fresh context on the same model is already the weak form; the same session is not a review at all. |
| Any stage that writes an artifact → the next | Fresh. | The next stage's input is the committed file. A session that also remembers the arguments behind it will design against the arguments. |
| `/slices` → `/slice` | Fresh, and **one slice per session**. | A slice that does not fit one session without compaction is too large — that is a `/slices` defect, so say so rather than pressing on. |
| `/slice` → `/verify` → `/pr` → `/resolve` | **Same session.** | These act on the branch and worktree the slice just produced, and `/pr` must carry `/verify`'s did-not-run list into the description **verbatim**. A fresh session would restate it from a summary, which is the fabricated gate result *Verification* exists to prevent. |
| merge → `/track` | Fresh. | `/track` reads the tracker and `design/` as they now stand. The session that just implemented the slice holds an opinion about whether it is done, and doneness is a human mark, not an agent's. |
| implementation → `/reconcile` | Fresh. | It compares the tree against the docs. The session that wrote the code carries what it *intended* to write, which is the one thing the comparison must not be given. |

**Compaction is a boundary you did not choose.** If a session compacts mid-slice, report it — the
slice was mis-sized, and the work after the compaction was done against a summary of the contract
rather than the contract.

### Budget discipline

- **Do not spend reasoning to manufacture findings, alternatives, or open questions.** A short
  honest answer beats a padded one; "none at this level" is a valid result.
- **Once a policy decision is signed off and recorded, do not relitigate it** without new evidence.
  Name the evidence if you think there is some.
- **Spend frontier-model reasoning on decisions that are expensive to reverse**, not on producing
  more prose.

### What should stop being model work

Routing decides *which* model does a job. This decides whether a model should be doing it at all.

| | Work | Where it belongs |
|---|---|---|
| 🟢 **Necessary** | Architecture, contracts, root-cause analysis, design tradeoffs, adjudicating findings | A model, at the tier above |
| 🟡 **Maybe avoidable** | Regenerating context already established, duplicate repository scans, rewriting boilerplate | A model, but the repetition is a signal — say so |
| 🔴 **Definitely avoidable** | Formatting, mechanical text transformation, arithmetic over files, counting, collecting metrics | Code. It should leave the model entirely |

**A red item is a defect in the tooling, not in the run.** Noticing one is worth a line; performing
it repeatedly and never saying so is the failure.

Two distinctions that are easy to get wrong:

- **The mechanical half of a task is red; the judgement half is not.** Opening an issue is an API
  call, but deciding what warrants one is not. Writing a PR description is a template, but which
  merge convention governs is not — `/pr` exists because that half is real. Do not classify a whole
  command by its cheapest step.
- **Do not report a cost you did not measure.** A model is not given its own token counts or
  elapsed time, so any figure it states about its own run is an estimate presented as a
  measurement. `tools/Measure-Session.ps1` reads the real per-call usage from the session
  transcript. Use it, or say nothing.

### Verification

- **Verify, don't assert.** State only what you have checked. Assert nothing from memory that a
  command could confirm — remembered values and inferred contracts are how wrong facts get written
  down confidently.
- **Do not claim a gate passed that did not run.** If a tool is unavailable, say so plainly and
  name what was not checked. "Tests pass" means you ran them and read the output.
- **Never state or imply a deployed URL or a published artifact** until the deploy for that exact
  commit reports success. A merged PR is not a deployed site. Poll; do not estimate. This applies
  directly here: rule 3 of `01-contract-rules.md` publishes schemas at version-pathed URLs, so a
  version is not "published" until that URL actually resolves.
- **A regression test is verified by reverting the fix** and confirming it fails. A test that
  passes with and without the fix guards nothing.

  (`01-contract-rules.md` rule 4 already states the schema-specific form of this rule — a
  generator that has never rejected anything is not known to constrain anything — so it is not
  repeated here a second time.)

### Working with me

- Present findings and review items **one at a time for sign-off**. Never bulk-apply findings
  unreviewed.
- Surface real forks as a question with a recommendation, recommended option first. The more
  rigorous non-recommended option is picked often enough that this matters — so ask, do not assume.
- **A reconciliation ends in a decision, not a report.** Any time you compare two things and find
  they disagree, the work is not finished at the findings. Close by asking, one divergence at a
  time, each with a recommendation and what the alternatives cost. Recommend the **resolution**,
  not merely which side you prefer: name what changes, in which file, and what it costs to reverse.
  If a comparison genuinely found nothing, say that plainly rather than manufacturing a fork.
- When a suggestion is declined, record it in the affected document as known-and-retained rather
  than dropping it silently. Otherwise it is rediscovered later as a bug.
- Ask before any choice that sets policy or a public contract: licensing, compatibility promises, a
  major information-architecture change.
- Call out assumptions, unverified claims, and known risks plainly. Explain the concrete evidence
  behind a recommendation.

### Git and delivery

- Run `git diff --check` before committing. Never use trailing double-spaces for a line break; it
  rejects them.
- **Never force-push or rewrite published history.** If a pushed commit needs changing, add a
  follow-up commit.
- **Push every commit before announcing a PR is ready.** Announcing invites an immediate merge, and
  a commit pushed after that lands on a branch nobody merges.
- External writes need authorization: creating a remote repository, changing visibility, pushing,
  opening or merging pull requests, changing a domain, deploying. Discussing a decision does not
  authorize it. One carve-out — see *Tracking work*, below.
- Do not delete files, branches, or history without explicit authorization.
- Check review **threads**, not just requested reviewers — an automated reviewer can leave blocking
  conversation threads that do not appear in a reviewer listing. Resolve a thread only when a
  validated fix satisfies it; leave ambiguous findings open and report them.
- **Resolving or replying to a review thread is not carved out.** The tracking-work exception below
  is for opening issues only. Where a repository delegates resolution explicitly, follow its
  wording; where it is silent, ask.

### Single ownership

*(`Reference, never restate` and `Move, never copy`, above under Conventions, already cover the
core rule — the two additions below are operational detail the kit adds on top.)*

- If a document genuinely must repeat something to stand on its own, name the canonical copy in the
  text and change both in the same commit. Naming a canonical copy is what makes the others
  checkable.
- **The test for where a decision belongs:** would a second consumer face this same question? If
  yes it belongs in the shared document, even while only one consumer exercises it. Where it is
  genuinely unclear, the shared document is the safer home — a rule that turns out to be specific
  is easy to relax later; a rule discovered to be shared after three consumers each answered it
  differently is a migration.

### Tracking work

**Defer work to the tracker rather than processing it inline.** A finding, a follow-up, or a defect
noticed in passing goes to a GitHub issue — not into a running list in conversation.

- **Opening and labelling issues in a repository you own is carved out of the authorization rule**
  above — no prompt needed. Issues are cheap and reversible, which is the entire justification; the
  exception is narrow and does not generalise.
- **Closing an issue is not carved out.** Nor is commenting on, editing, or labelling anyone else's,
  nor writing to a repository you do not own.
- **Milestones and projects still need approval.** They are structural and few, and a wrong one is
  visible on a public repository.
- **Every issue reads human-first.** A narrative anyone can follow, then `### Done when`
  checkboxes, then agent detail in a collapsed `<details>` block, fenced by
  `<!-- agent:start -->` / `<!-- agent:end -->` — inside the fence is regenerable, outside it is
  never touched.
- **Bugs and stories are filed by hand** from `.github/ISSUE_TEMPLATE/`.
- **This does not suspend one-at-a-time sign-off.** Findings are still presented for adjudication;
  the tracker is where the ones you accept go, not a way to skip the conversation.

This repository has no `design/30-slices.md` yet (see *Why it is installed this way*), so the
kit's `/track` machinery for syncing slice criteria into issues has nothing to sync against until
that changes. The carve-outs above still apply to any issue opened by hand in the meantime.

### House conventions

- Windows host, projects under `D:\Dropbox\Projects\`. PowerShell Core for scripts.
- Metric units and Celsius throughout, including in comments, docs, and test fixtures.
- Raster assets as PNG or JPG. Not WebP.
- Scripts run without interactive confirmation prompts. Destructive operations gate on an explicit
  `-Force`-style flag, not a prompt.
- A repository with an established commit-message style keeps it. Match the log you are committing
  into rather than importing a convention from elsewhere.

### What not to do

- Do not summarise the design docs back at a person unless asked.
- Do not add commentary about your reasoning process to the docs.
- Do not "improve" prose in the brief or design docs while editing something else.
- Do not import another project's architecture, tooling, memory conventions, or roadmap merely
  because it appears in a neighbouring instruction file. Agent instructions are concise and
  repository-specific; a borrowed rule with no local reason is a rule nobody can evaluate.

---

## Why it is installed this way

Recorded per `SubZeroDev.AgentKit`'s `INSTALL.md` phase 4, since this repository has no
`design/90-decisions.md` and no other slice-local decision log.

- **`AGENTS.md` stays the contract file; `CLAUDE.md` stays a pointer.** Both already existed before
  install, in that arrangement, matching the kit's own default. Kept as-is rather than flipped —
  `CLAUDE.md` already states why it is a pointer, and the direction was not in question.
- **The kit's general operating-discipline sections were merged in** (safe start, model/command
  routing, budget discipline, verification, working-with-me, git and delivery, single ownership
  additions, house conventions, what-not-to-do). Rules the kit restates that this file already had
  — reference/move-never-copy, stage-by-named-path, no-AI-attribution, UTF-8/LF, the schema-rejection
  verification rule — were left out rather than duplicated; they remain in `01-contract-rules.md`
  and the *Conventions* section above.
- **The kit's `design/` docs, `Source of truth` precedence section, `Hard rules`, `Tracking work`'s
  slice-sync mechanics, and `Decision logging` (pointed at `design/90-decisions.md`) were not
  installed.** This repository already has an established, narrower document chain — README →
  `01-contract-rules.md` → this file — and defers its ADRs to `SubZeroDev.Platform` (ADR-005) rather
  than keeping a local decisions directory. Installing the kit's brief → design → contract → slices
  pipeline on top of that is a real fork with a real cost either way and was left for a human to
  decide rather than guessed at in an unattended run — see the install report.
- **`agent.md` was installed with the kit's full seed, then pruned.** Four lessons had nothing to
  attach to in this repository (no CI workflow, no prettier/lint tooling, and no test suite exist
  here yet) and were removed on 2026-08-09 with approval: the CI-permissions lesson, the
  `prettier --check` CRLF/LF lesson, the required-status-check lesson, and the
  intermittent-test/connection-pooling lesson. The rest of the seed stands.
