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
