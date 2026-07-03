# a.EYE Leaderboard

Community benchmark results from [a.EYE](https://github.com/) — local LLMs ranked
by **quality-per-kilojoule** (answer quality per unit of energy) on real Apple
Silicon hardware.

## How it works

1. In a.EYE: run a gauntlet → grade it with the AI judge → **Submit to leaderboard**.
2. That opens a prefilled GitHub **issue** containing the result as JSON.
3. A GitHub Action (`.github/workflows/ingest.yml`) validates the JSON and
   appends it to `leaderboard.json` automatically, tagging the entry
   `verified: false` and linking back to the source issue.
4. Maintainer verifies later (see below).

## One-time setup

1. Create a **public** repo and copy these files into it
   (`leaderboard.json`, `index.html`, `scripts/`, `.github/`).
2. **Settings → Actions → General → Workflow permissions → “Read and write
   permissions”** (lets the Action commit + comment).
3. *(Optional web view)* **Settings → Pages → Source: Deploy from branch →
   `main` / root.** Your board is then at
   `https://<you>.github.io/<repo>/`.
4. In the a.EYE **Leaderboard** tab, set:
   - **Dataset URL:** `https://raw.githubusercontent.com/<you>/<repo>/main/leaderboard.json`
   - **Submission repo:** `<you>/<repo>`

## Verifying submissions (after the fact)

Entries are auto-added as `"verified": false`. To vet one:

- Open the linked issue (each entry has `sourceIssue`), sanity-check the numbers.
- To mark verified, edit `leaderboard.json` and set that entry's
  `"verified": true` (the web view can filter to verified-only).
- To remove a bogus entry, delete its object from `leaderboard.json`.

## Entry schema

```json
{
  "id": "uuid",
  "model": "Qwen3-8B-4bit",
  "runtime": "MLX",
  "suiteVersion": "1.1",
  "quality": 82,
  "tokensPerSecond": 41.3,
  "energyJoules": 640.0,
  "qualityPerKilojoule": 128.1,
  "tokensPerJoule": 3.1,
  "chip": "Apple M2 Ultra",
  "memoryGB": 96,
  "appVersion": "1.0",
  "date": "2026-07-02T17:00:00Z",
  "official": true,
  "sourceIssue": 12,
  "submittedBy": "someuser",
  "verified": false,
  "ingestedAt": "2026-07-02T17:01:00Z"
}
```

## Privacy

Each entry contains **hardware specs** (chip name, RAM) and **benchmark scores**
only — no serial numbers, hostnames, usernames, IPs, file paths, or model
outputs. The public dataset stores an **anonymized handle** (`anon-xxxxxx`,
a stable non-reversible hash) instead of the submitter's GitHub username. The
real submitter is only discoverable by the maintainer via the entry's
`sourceIssue` (the GitHub issue is public and tied to the submitter's account —
inherent to issue-based submission).

## Trust & abuse notes

Submissions are open, so numbers are self-reported. The Action validates
**shape and ranges** only. Real trust comes from the `verified` flag + your
review. For stronger guarantees later: server-side judging, signed results, or
hardware attestation.
