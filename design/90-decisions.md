# Decision log

Append-only. Newest at the top. The rejected alternatives are the point — without them, every future session relitigates the same choice.

## Open
<Questions still undecided. A *todo* noticed while building is a GitHub issue, not an entry here.>

---

### 2026-10-06 — Remove the per-repository SessionEnd cost hook
Context: `.claude/settings.json` ran `pwsh … tools/Measure-Session.ps1` on `SessionEnd`, but that script no longer exists — it left this repository when the kit moved to a single home install, and the kit later ported it to Node as `measure-session.ts` — so the hook failed at the end of every session. The kit's setup installs one global `SessionEnd` hook in `~/.claude/settings.json` that logs every project.
Chosen: remove this repository's `hooks.SessionEnd` entry, in the AgentKit sync to `v2026.10.06.1`. Nothing else in `settings.json` changes.
Rejected: point it at `measure-session.ts` — the global hook already runs that script, so every session would be logged twice; leave it — it keeps failing at every session end.
