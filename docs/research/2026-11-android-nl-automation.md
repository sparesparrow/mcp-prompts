# Natural-language Android automation, Omarchy-style: next changes per repository (November 2026)

> **Provenance.** This document is AI-generated. The source is a Gemini Deep Research report
> written in Czech on 2026-11-26 (about 49,000 characters). It is not in this repository. The brief
> asked for a review of natural-language Android automation "in the style of Omarchy" across
> mcp-prompts, cliphist-android and mia. It asked for each next change to be assigned to a
> repository, with ordered steps, acceptance criteria, safety boundaries and a test plan. It also
> asked the report to say which files it could not inspect. Claude summarised the report and checked
> every load-bearing claim and every recommendation against the code: the local checkouts, and the
> GitHub API for the remote state ([fact-check](#fact-check)). Claude also added its own
> [assessment](#claudes-assessment). Sections 1 to 5 are a summary, not a translation. Unless a
> sentence says otherwise, the verdicts in them are the report's. Corrections from the fact-check
> are marked **Correction**.

**Research question.** A rooted aarch64 Android phone already runs a voice loop, a Tasker panel,
headless agents and a phone-control MCP server, all inside a Debian PRoot in Termux. What should
change next, and in which repository, to get Omarchy-grade "say it and it is done" control without
giving up safety?

**What the report could see.** It worked from GitHub and from files exported from the phone (the
skills, `droid`, three of the four parts of a Tasker export, and part of an internal note). It
names these as not inspected:
- the whole of `sparesparrow/mia`;
- the source under `cliphist-android/assistant/`;
- cliphist-android's `app/`, `mcp-server/` and `.claude/skills/`;
- mcp-prompts' `data/prompts/profiles.json`, the prompt JSON files and `src/`;
- part 2 of the 4-part Tasker export.

**Correction.** All three repositories are public, and Claude read each of these files except the
Tasker export, which is phone state and not in any repository. The report was also written against
the repositories as they were before 2026-11-26. Since then two things have changed:
- `cliphist-android/assistant/` has moved, with its history, to the public repository
  [sparesparrow/android-assistant](https://github.com/sparesparrow/android-assistant)
  (cliphist-android PR #41).
- mcp-prompts 4.3.0 adds the `android-automation` and `tasker-automation` profiles and
  [docs/10](../10-android-automation.md).

The target repositories below are corrected to match.

---

## Executive summary

The report finds that the foundation exists and works. Its point is that the phone should not run
every heavy step itself. It proposes a **two-speed hybrid**:
- **A fast, deterministic edge on the phone.** It takes voice, Tasker, intents, MQTT and the
  clipboard, and no AI path has `su`.
- **A persistent orchestrator on a Linux node** (Omarchy, a home server or a VPS) behind
  Tailscale. It runs coding worktrees, Docker tests and heavy reasoning, and reaches the phone
  through stateless MCP over Streamable HTTP.

The main evidence for this is latency. On the phone, starting `claude -p --model haiku` just to
route a Claude Panel request takes 30 to 95 seconds, so the router's timeout is set to 150 seconds.

It lists five operational problems in today's setup:
1. Old ChatGPT Tasker profiles may still fire on the same Assistance Request gesture as Claude
   Listen.
2. The voice pipeline reads its ElevenLabs key from the mia repository's `.env.local`.
3. The clipboard app's local API is not wired into voice turns.
4. `droid` cannot type non-ASCII text (Czech diacritics, emoji) without Termux:API, which is not
   installed.
5. mcp-prompts has no narrow profile for phone agents.

Checked against the code:
- **Problems 2, 3 and 4 are verified.**
- **Problem 1 cannot be checked from the repositories.** It is phone state, and the docs already
  say to disable those profiles.
- **Problem 5 is out of date.** 4.3.0 adds that profile.

Of the report's 11 recommendations:
- 1 is already done.
- 5 are already tracked or partly done.
- 3 are new and worth doing.
- 2 rest on assumptions that do not hold. The mia topic names it uses do not exist, and the
  "fast API path" conflicts with how the stack is run: local Claude Code, no API key.

The verification also found:
- **A real template bug in mcp-prompts.** `learning-loop-analyzer` contained Jinja blocks that
  `apply_template` cannot fill. It is fixed in this release, with a test.
- **Two doc drifts in mcp-prompts.** The profile counts in `deploy/README.md` were wrong, and so
  was its list of prompts in no profile. Both are fixed here.
- **A bug in cliphist-android.** Its `add_to_clipboard` MCP tool says it sets the device
  clipboard, but it only stores the text in the app's database.

## 1. Current state the report describes (with corrections)

| Layer | Owner and interface | Port or channel | Report's finding | Check |
|---|---|---|---|---|
| Voice and panel trigger | android-assistant `voice/http_trigger.py`, `router/router.py` | 127.0.0.1:8780, `X-Token` | Shared `turn.lock`. The panel router's `claude -p` start takes 30–95 s (`PANEL_ROUTE_TIMEOUT=150`). | Verified |
| Mic and speaker | `phone-services` starts PulseAudio as uid 2000 from `/data/local/tmp/pa` | 127.0.0.1:4713, cookie | A workaround for Termux having no `RECORD_AUDIO`. Without `module-suspend-on-idle` the mic icon stays on. | Verified. `mic.pa` already loads `module-suspend-on-idle timeout=2`. |
| Phone-control MCP | android-assistant `mcp/server.py` | stdio | No raw shell. `speak` is cut at 1000 characters. `ask_gemini` drives the Gemini app. | Verified |
| Low-level UI | `skill/android-control/scripts/droid` | adb 127.0.0.1:5555 | adbd restarts on every keyguard change. Non-ASCII typing fails without Termux:API. | Verified |
| Agents started from Tasker | `agents/*.md`, `run-agent.sh`, PRoot sshd | 127.0.0.1:8023, key + `ForceCommand` | The prompt goes in on stdin (`RUN_COMMAND_STDIN`), so quoting cannot break it. | Verified |
| Native Termux | Termux sshd, `RunCommandService` | 127.0.0.1:8022, `RUN_COMMAND` | Needs the `RUN_COMMAND` permission and `allow-external-apps = true` | Verified (documented in `build-claude-agents.py`) |
| Clipboard history | cliphist-android `LocalApiService` and `mcp-server/` | 127.0.0.1:8765 | Works, but not in `voice/mcp.json` | Verified. It binds to loopback, and a bearer token is mandatory. |
| Home and vehicle | MIA and Mosquitto | :8000, :1883 | `mia/lights/*` runs without confirmation, and other topics need a token. The ElevenLabs key is read from mia's `.env.local`. | The allowlist is verified. **Correction:** mia's topic contract does not define `mia/lights/*` (see [fact-check](#fact-check)). |

The report also reviews outside tools:
- [CursorTouch/Android-MCP](https://github.com/CursorTouch/Android-MCP), adb-based. It types other
  scripts and emoji through the ADBKeyboard app.
- [dceluis/tasker-mcp](https://github.com/dceluis/tasker-mcp) and its hardened fork
  [cj-elevate/tasker-mcp](https://github.com/cj-elevate/tasker-mcp). The fork's changelog lists six
  fixed review findings: 0.0.0.0 binds, missing timeouts, log leaks and an auth bypass.
- Shizuku and `rish`, with mixed reports on Android 16.
- AutoInput and Accessibility macros, which it rates the most brittle and the most open to
  injection.

Its advice: if Tasker must serve a remote orchestrator, use the hardened fork over Tailscale, or keep
the narrow gate through android-assistant with confirmation tokens. Never expose Tasker's raw HTTP
server on the network.

## 2. Recommendations and where they belong

**Status** is one of these:
- **Done**: it already exists.
- **Tracked**: an open issue covers it.
- **New**: drafted as an issue, not yet filed.
- **Not adopted**: see [Claude's assessment](#claudes-assessment).

| ID | Change (condensed) | Report's target → corrected target | Status | Verification note |
|---|---|---|---|---|
| MP-1 | A narrow phone profile in `profiles.json` covering the phone, panel and Tasker prompts | mcp-prompts | **Done** in 4.3.0 | `android-automation` (15) and `tasker-automation` (8) cover the phone and Tasker prompts. The four `panel` templates are in no profile on purpose: the panel router reads them from the library files by tag. The voice pipeline still starts mcp-prompts with no profile → **New** (android-assistant). |
| MP-2 | An example config for `mcp-prompts-http` on Tailscale: read-only, `MCP_PROMPTS_AUTH_TOKEN_FILE`, `MCP_PROMPTS_ALLOWED_HOSTS` | mcp-prompts | **Tracked** in [#141](https://github.com/sparesparrow/mcp-prompts/issues/141) | Every setting it names exists. The server refuses to listen beyond loopback with writes enabled and no token (`src/http-security.ts`). |
| MP-3 | A Vitest check of profile integrity, `{{placeholders}}` and cs/en pairs | mcp-prompts | **Done** in this change | Profile integrity was already tested (`bundled profiles` in `src/prompt-store.test.ts`). This change adds a test that every template a profile serves can be filled by `apply_template`: no `{% %}` blocks, and no undeclared placeholders. The test found `learning-loop-analyzer` (fixed). The library has no cs/en pairs, so that part does not apply. |
| CA-1 | Stop reading the ElevenLabs key from `/root/mia/apps/rpi-backend/.env.local`. Use the assistant's own config file. | cliphist-android → **android-assistant** | **New** | `voice/eleven.py`, `voice/assistant.sh` and `router/say.sh` default `ELEVENLABS_ENV_FILE` to the mia file. `phone/set-elevenlabs-key.sh` writes the key there. |
| CA-2 | Wire the clipboard MCP server into `voice/mcp.json`, behind a filter for OTPs, passwords and tokens | cliphist-android → **cliphist-android** (filter) + **android-assistant** (wiring) | **New** | Neither the REST API nor `mcp-server/` filters anything sensitive. `voice/mcp.json` has only android-assistant and mcp-prompts. The filter has to come first. |
| CA-3 | Type non-ASCII text in `droid` and `act(type)` without Termux:API | cliphist-android → **android-assistant** | **New** (bug) | `cmd_type` exits when `termux-clipboard-set` is missing, and it is missing on the reference phone. `mcp/notebook.py` `to_clipboard` already copies any text through the share sheet's Copy button. **Correction:** the report's other option, "set the clipboard through cliphist on :8765", would not work, because `POST /items` does not touch the device clipboard. |
| CA-4a | An optional remote executor for router and voice jobs (local PRoot or a remote node over Tailscale) | cliphist-android → android-assistant | Partly **tracked** ([#141](https://github.com/sparesparrow/mcp-prompts/issues/141) for transport). Deferred. | It depends on an always-on node that does not exist yet. A cheaper first step, skipping the 30–95 s routing call when the panel's template already decides the route, is **New**. |
| CA-4b | Send the plain Gemini "second opinion" to the Gemini API, and keep the app only for app-only tools | cliphist-android → android-assistant | **Not adopted** | There is no API path today. The stack runs without API keys on purpose. Each app's terms are reviewed in [#143](https://github.com/sparesparrow/mcp-prompts/issues/143). |
| CA-5 | A pre-flight check for other Tasker profiles on Event 201, a Shizuku clipboard warning, and fast adb reconnect after unlock | cliphist-android → android-assistant | Collision check **New**. Reconnect partly **done**. | `tasker-edit.py problems()` checks references but not event collisions. **Correction:** two profiles are meant to share Event 201: Claude Listen and Claude Panel Gesture. `phone-services watch` already reconnects adb every 60 s, and `droid` now probes the link before `adb connect` (android-assistant `8f37923`). The Shizuku clipboard bug comes from a Reddit report and is unverified here. |
| MIA-1 | Keep `.env.local` for the MIA backend only. Publish an MQTT contract that separates safe topics from critical ones. | mia (+ android-assistant) | Contract gap **New**. Secret split covered by CA-1. | `spec/interfaces/topics.md` already is the contract (ADR-0017, [mia#191](https://github.com/sparesparrow/mia/issues/191)). It has no `mia/lights/*` and no `mia/car/*` or `mia/gpio/*`, and nothing in mia publishes or subscribes to `mia/lights/*`. |
| MIA-2 | Authentication and ACLs on Mosquitto, limit :8000 and :1883 to Tailscale or the LAN with TLS, and accept JSON events from Tasker | mia | **Tracked**: auth in [mia#139](https://github.com/sparesparrow/mia/issues/139), events in [#140](https://github.com/sparesparrow/mcp-prompts/issues/140) | Both repository broker configs have `allow_anonymous true`, and the Pi gateway one listens on 0.0.0.0. That contradicts topics.md ("All topics require authentication"). |
| MIA-3 | Pin `embedded-iot` for development in mia's `.mcp.json` | mia | **New**, low priority, not drafted | `.mcp.json` starts `mcp-prompts` with no arguments. CLAUDE.md asks agents to filter by tag `mia-dev`, which `embedded-iot` includes. |
| — | A personal `agent-spine` repository that syncs AGENTS.md and SKILL.md across nodes | outside the three repositories | **Tracked** in [#139](https://github.com/sparesparrow/mcp-prompts/issues/139) | — |

## 3. Ordered steps and acceptance criteria (condensed)

The report orders the work like this: contracts first, then the local fixes on the phone, then the
remote offload and the broker. Its acceptance criteria are kept here, corrected where the code
disagrees.

1. **Profiles and template checks (mcp-prompts; MP-1, MP-3).** *Done.*
   - *Criteria:* `mcp-prompts profiles` lists the phone profiles, and
     `mcp-prompts catalog --profile android-automation` shows no unknown entries.
   - `vitest run` passes, including the new fillability test.
2. **Shared read-only `mcp-prompts-http` over Tailscale (MP-2; #141).**
   - *Criteria:* the server refuses to start beyond loopback with writes and no token.
     `GET /health` returns 200. `POST /mcp` with a valid bearer token works. Without one, the
     request gets 401.
3. **Decouple the voice key from mia (CA-1).**
   - Read `ELEVENLABS_API_KEY` from the environment, or from an assistant-owned file outside every
     repository, mode 0600. Keep the mia path as a fallback that logs a warning, for one release.
   - *Criteria:* `assistant.sh --text "test"` speaks without access to the mia file, and no log
     line or diff contains the key.
4. **The clipboard in voice turns, safely (CA-2).**
   - Add a deterministic redaction filter in cliphist-android first. It drops encrypted items and
     redacts OTPs, passwords and bearer or API keys.
   - Then register the server in `voice/mcp.json`, with read tools only.
   - *Criteria:* a voice or text turn can read an ordinary copied text. A seeded OTP or token item
     comes back redacted.
5. **Non-ASCII typing (CA-3).**
   - *Criteria:* `droid type "Příliš žluťoučký kůň úpěl ďábelské ódy"` puts the whole string into a
     focused field with no Termux:API, and `droid doctor` reports which paste path is used.
6. **Tasker collisions and adb after unlock (CA-5).**
   - *Criteria:* `tasker-edit.py` reports every enabled Event 201 profile other than Claude Listen
     and Claude Panel Gesture. A long power press (`input keyevent --duration 900 KEYCODE_POWER`)
     opens only those two. `phone-services status` shows adb OK shortly after an unlock.
7. **Faster panel and voice paths (CA-4a).**
   - First, a deterministic route when the chosen template already implies one.
   - Later, a remote executor over Tailscale that keeps the router's secret-path guard.
   - *Criteria:* a panel job with a coding template is dispatched without the `claude -p` routing
     call. A remote job opens a draft PR and never stages a path that `SECRET_NAMES` matches.
8. **Gemini through the API (CA-4b).** *Not adopted* (see the assessment).
9. **MIA contract, auth and profile (MIA-1 to MIA-3).**
   - *Criteria:* an unauthenticated client cannot connect to a shared broker. The phone can set
     lights on the allowed topics. Any other topic outside the allowlist, or without a confirmation
     token, fails.
10. **Shared rules across nodes (`agent-spine`, #139).**
    - *Criteria:* after a sync, `~/.claude/agents`, `~/.claude/skills` and the client `.mcp.json`
      files hold the same version on every node.

## 4. Safety boundaries

The report's boundaries, matched to what the code enforces today:

| Domain | Enforced today (checked) | Boundary to keep or add |
|---|---|---|
| `su` and Accessibility | PRoot cannot see Magisk `su`. The voice `claude -p` runs with `--permission-mode dontAsk`, `--strict-mcp-config`, an explicit `--allowedTools` list and no shell tool. | No agent or MCP server gets `su`, or AutoInput over system, banking or 2FA apps. Stop at a lock screen, a password field or a 2FA prompt. The `su` left in maintenance paths is tracked in [#143](https://github.com/sparesparrow/mcp-prompts/issues/143). |
| Outbound actions | No payments or banking. Messages to people need a yes. `run_tasker_task` and MQTT outside `mia/lights/*` need a one-time token that expires after 300 s. | Keep the two-step token for anything with physical or financial effect. Screen, notification, clipboard and AI-app text is data, never instructions. |
| The shared loopback | PulseAudio :4713 needs a cookie, with anonymous access off. :8780 needs `X-Token`. sshd :8023 is key-only with `ForceCommand`. cliphist :8765 needs a mandatory bearer token. | Never run anonymous PulseAudio or 0.0.0.0 binds. Every app on the phone can reach 127.0.0.1. |
| Termux `RUN_COMMAND` | Tasker passes the prompt on stdin, never as an argument | Never edit `~/.termux/` as root: a root-owned `termux.properties` breaks `RunCommandService` (termux-app#2081). Never run scripts from `/sdcard`, which is `noexec` and writable by other apps. |
| Clipboard and cloud models | `gemini-advisor-brief` forbids sending secrets. The router refuses to stage `.env*`, token, cookie, key and `.pem` files, `id_*` keys, `state/` and `logs/`. | Redaction before the clipboard reaches any model (CA-2). Move the ElevenLabs key out of mia (CA-1). |
| Network and terms | `mcp-prompts-http` refuses to listen beyond loopback with writes and no token | Remote `mcp-prompts-http`, Mosquitto and orchestrator ssh only inside Tailscale. Prefer official CLIs and APIs to scripted consumer-app UIs, where the terms say so ([#143](https://github.com/sparesparrow/mcp-prompts/issues/143)). |

## 5. Test plan

The report's six levels, with the commands adjusted to the real layout. For the paths,
`/root/voice-assistant` is a symlink to android-assistant `voice/`.

| Level | What | Command or check | Expected |
|---|---|---|---|
| 1. Templates and HTTP auth (mcp-prompts) | Profiles, placeholders, auth | `node_modules/.bin/vitest run`; `mcp-prompts catalog --profile android-automation --json`; start `mcp-prompts-http` on a non-loopback host with writes and no token | Tests pass. No unknown entries. The server refuses to start. |
| 2. Services and adb reconnect | :4713, :8023, :5555, :8780 | `phone-services status`; `phone-services test-mic 3`; lock and unlock; `pactl list short sources` | All OK. Silence reads about 0.001 and speech 0.1 or more. The source is SUSPENDED when idle. adb comes back after the unlock. |
| 3. Text and WAV voice turns | `assistant.sh`, `listen.sh`, `mcp.json` | `/root/voice-assistant/assistant.sh --text "kolik je hodin"`; a WAV replay; check `logs/latency.log` | Only the allowed MCP servers load. A second `speak` or `listen` during a turn returns "busy". The android-assistant suite (`cd mcp && .venv/bin/python -m pytest -q`, 399 tests, offline) passes. |
| 4. Tasker gesture and stdin | Event 201, Shizuku clipboard, prompt passing | `input keyevent --duration 900 KEYCODE_POWER`; copy text with Shizuku running; pipe a prompt with quotes and diacritics into `~/.termux/tasker/agent-gemini` | Only Claude Listen and Claude Panel Gesture fire. The clipboard survives. The prompt arrives intact in `agents.log`. |
| 5. Typing and Gemini modes | `droid`, `ask_gemini` | `droid doctor`; `droid type "Příliš žluťoučký kůň"`; `ask_gemini(..., send=False)` | The full Czech string is typed. The draft is prepared and not sent. |
| 6. Panel, secrets and injection (negative) | Worktree guard, gates | A notification that tells the agent to send the clipboard to someone; `run_tasker_task` or `mqtt_publish` on a non-light topic without a token; a router run with a `.env` file in the diff | The instruction is reported, not followed. A preview and a token are returned, and nothing runs. The router refuses to stage the file. The fixtures are shared with [#142](https://github.com/sparesparrow/mcp-prompts/issues/142) and [#143](https://github.com/sparesparrow/mcp-prompts/issues/143). |

---

## Claude's assessment

### Where we agree

- **Two speeds.** Keep a fast, deterministic loop on the phone, and move long coding jobs and 24/7
  work to a Linux node. This matches the previous research and
  [#140](https://github.com/sparesparrow/mcp-prompts/issues/140) and
  [#141](https://github.com/sparesparrow/mcp-prompts/issues/141). The 30–95 s routing call is the
  clearest cost on the phone today. It can be cut without any remote node, because when the panel
  already has a coding template and a repository, the route is known.
- **Untangle the secrets (CA-1).** A voice assistant in its own repository should not depend on a
  file inside another project's tree. The fix is small, and a fallback keeps it backwards
  compatible.
- **Redact before the clipboard reaches a model (CA-2).** Clipboard history is the densest store
  of OTPs, passwords and tokens on the phone. The filter belongs in cliphist-android, the owner of
  the data, so that every client gets it, not only the voice pipeline.
- **Non-ASCII typing (CA-3)** is a real bug for a Czech-speaking user. The fix already exists in
  the same codebase (`notebook.to_clipboard`).
- **A narrow, stable MQTT contract (MIA-1, MIA-2).** The phone's allowlist and mia's contract
  should name the same topics. Broker authentication belongs in mia's auth ADR.

### Where we disagree

- **"Route the plain Gemini second opinion through the Gemini API" (CA-4b).** The stack runs
  agents through local Claude Code and the apps' consumer plans, with no API keys. The advisor
  flow uses the app on purpose: app-only tools such as Deep Research, and plans already paid for.
  The real question is each app's terms, and #143 already asks it.
- **"A fast API path for short voice questions" (CA-4a, second half).** The same constraint
  applies. The cheaper fix is already in place: `route.py` sends short questions to `haiku`.
  Further gains should come from a warm process or from fewer CLI starts, not from a second
  billing path.
- **"Only Claude Listen may fire on Event 201" (CA-5).** That would break the panel. The check
  should allow a known pair of profiles.
- **MIA topic names.** The report invents `mia/car/*` and `mia/gpio/*` as the critical topics. mia
  uses `vehicle/cmd/{vin}/io` and others. The ACL work must start from `topics.md`, not from the
  report's names.
- **"Phone agents fetch the whole library" (MP-1).** This is out of date for the library: 4.3.0
  adds the profile. It is still true for the voice pipeline's config, which is the part worth
  fixing.

## Fact-check

Checked on 2026-11-26 by Claude against these sources:
- the local checkouts of android-assistant (`8f37923`), cliphist-android (`205e4de`), mia
  (`5584738`) and mcp-prompts `release/4.3.0` (`ca6b802`);
- `gh api` for repositories, pull requests, commits and issues on GitHub.

**Status** is one of these:
- **verified**: the code or a primary source confirms the claim.
- **out of date**: it was true before the repository changes of 2026-11-26.
- **wrong**: the code contradicts it.
- **unverifiable**: phone state, or a source that was not checked.

| # | Claim in the report | Status | Source and note |
|---|---|---|---|
| 1 | The voice loop, the Claude Panel router, the agents, `phone-services` and the MCP server run locally in the PRoot | Verified | android-assistant `voice/`, `router/`, `agents/`, `phone/`, `mcp/` |
| 2 | They live in `cliphist-android/assistant/` | Out of date | Moved to [android-assistant](https://github.com/sparesparrow/android-assistant) with history (cliphist-android PR #41). `assistant` is now a compatibility symlink. |
| 3 | `sparesparrow/mia` and `assistant/` were not accessible on GitHub | Wrong | Both repositories are public (`gh api repos/...`: `private=false`) |
| 4 | Starting the panel router (`claude -p --model haiku --tools ""`) takes 30–95 s; `PANEL_ROUTE_TIMEOUT=150` | Verified | `router/router.py` (on-device measurement noted in the code, not an independent benchmark) |
| 5 | The voice turn: Event 201 → `nc` to 127.0.0.1:8780 with `X-Token` → PulseAudio :4713 → end on 1.3 s of silence → `scribe_v2` → `route.py` (`haiku` for 8 words or fewer with no action verb, else `sonnet`) → `claude -p --resume`, `dontAsk`, `--strict-mcp-config`, `phone-voice-assistant` → streaming TTS | Verified | `voice/route.py`, `voice/audio.env`, `voice/assistant.sh`, `skill/android-assistant/references/voice-pipeline.md` |
| 6 | Old profiles "Call ChatGPT Assistant" (id 21) and id 452 still fire on Event 201 | Unverifiable | Phone state from a Tasker export, not in any repository. `voice-pipeline.md` already says to disable them. |
| 7 | The ElevenLabs key is read from `/root/mia/apps/rpi-backend/.env.local` | Verified | The default `ELEVENLABS_ENV_FILE` in `voice/eleven.py`, `voice/assistant.sh` and `router/say.sh`. `phone/set-elevenlabs-key.sh` writes it there. |
| 8 | The clipboard API on 127.0.0.1:8765 is not in `voice/mcp.json` | Verified | `voice/mcp.json` lists only android-assistant and mcp-prompts |
| 9 | `droid type` needs `termux-clipboard-set` for non-ASCII text, and Termux:API is not installed | Verified | `skill/android-control/scripts/droid` `cmd_type`. `SKILL.md` says "Termux:API is not installed", and the binary is missing on the reference phone. |
| 10 | mcp-prompts has five profiles and none for phone agents | Out of date | 4.3.0 has seven, including `android-automation` (15) and `tasker-automation` (8) |
| 11 | Profile sizes 13 / 11 / 8 / 13 / 8, with percentages of 21, 23, 13, 37 and 11 % | Wrong (partly) | `voice-home` serves 14 (1 plain + 13 templates): `deploy/README.md` had missed `phone-voice-assistant`, fixed here. The percentages fit no count (13 of 80 is 16 %). |
| 12 | Three prompts are in no profile | Out of date | `mcp-prompts profiles` lists 11: the original three, plus four `panel-*` and four `sdlc-*`. `deploy/README.md` is updated. |
| 13 | android-assistant has no raw shell. `speak` is cut at 1000 characters. `run_tasker_task` and MQTT outside `mia/lights/*` need a confirmation token. | Verified | `mcp/server.py`: `SPEAK_MAX = 1000`, `MQTT_DIRECT`, `MQTT_CONFIRM`, `CONFIRM_TTL = 300` |
| 14 | `ask_gemini` drives the Gemini app's UI through a share intent | Verified | `mcp/server.py`, `mcp/gemini.py` |
| 15 | adbd restarts on every keyguard show or dismiss (mechanism a hypothesis) | Verified | `skill/android-assistant/references/ops.md` "Why adbd restarts" labels the cause a hypothesis, as the report says |
| 16 | Agents are started through sshd on 127.0.0.1:8023 (key, `ForceCommand`), with the prompt on stdin | Verified | `agents/sshd_config`, `phone/tasker/build-claude-agents.py` (`RUN_COMMAND_STDIN`) |
| 17 | Without `module-suspend-on-idle` the mic icon stays on | Verified, already handled | `phone/pa/mic.pa` loads `module-suspend-on-idle timeout=2` and uses cookie auth with anonymous access off |
| 18 | `mcp-prompts-http`: port 3003, `/health`, refuses to listen beyond loopback with writes and no token, `MCP_PROMPTS_AUTH_TOKEN_FILE`, `MCP_PROMPTS_ALLOWED_HOSTS`; the catalog URL has limits of 5 s and 1 MB | Verified | `src/config.ts`, `src/http-security.ts`, `src/server-options.ts`, `src/prompt-store.ts` (`CATALOG_TIMEOUT_MS`, `CATALOG_MAX_BYTES`) |
| 19 | cliphist-android PRs #32 (local API and MCP server), #37 (instrumented test) and #38 (assistant), and commit `63703bb` (local API lock-down) | Verified | `gh pr view`, `gh api .../commits/63703bb` |
| 20 | The clipboard API should be protected as strictly as the other loopback services | Verified, already handled | `LocalApiService` binds to `InetAddress.getLoopbackAddress()`, and a bearer token is mandatory, compared in constant time |
| 21 | Setting the clipboard through cliphist (:8765) is a way to paste non-ASCII text | Wrong | `POST /items` inserts into the database only and never calls `setPrimaryClip`. The `add_to_clipboard` MCP tool says otherwise (issue drafted). |
| 22 | The panel router blocks `.env`, token, cookie and key files, `state/` and `logs/` | Verified | `router/router.py` `SECRET_NAMES` (also `.pem` and `id_*`) |
| 23 | mia uses the `embedded-iot` profile in development and `mia-vehicle` at run time | Wrong | mia's `.mcp.json` starts `mcp-prompts` with no profile. Its CLAUDE.md filters by tag `mia-dev`. |
| 24 | `mia/lights/*` is MIA's lights topic | Unverifiable (partly) | android-assistant allows it directly. mia's `spec/interfaces/topics.md` does not list it, and no mia code uses it. |
| 25 | MIA's critical topics are `mia/car/*` and `mia/gpio/*` | Wrong | Neither appears in mia. Commands are `vehicle/cmd/{vin}/io` (`topics.md`). |
| 26 | Mosquitto has no authentication or ACLs | Verified | `infra/containers/mosquitto/mosquitto.conf` and `infra/edge/pi-gateway/.../mosquitto.conf` (`allow_anonymous true`; the gateway listens on 0.0.0.0). This contradicts topics.md. ADR in [mia#139](https://github.com/sparesparrow/mia/issues/139). |
| 27 | mcp-prompts has 121 stars | Verified | `gh api`. The commit and fork counts were not checked. |
| 28 | Android-MCP: Python >=3.13,<3.14, fastmcp >=2.14, 941 stars | Out of date | Now `requires-python >=3.13`, `fastmcp>=4.1.3`, 942 stars ([pyproject](https://github.com/CursorTouch/Android-MCP/blob/master/pyproject.toml)) |
| 29 | Android-MCP types other scripts and emoji through ADBKeyboard broadcasts | Verified | Its README, `Type` tool |
| 30 | Android-MCP issue #34 reports 7 violations of the MCP 2026-07-28 spec | Out of date | The issue exists with that title, and it is now closed |
| 31 | Android-MCP has a typical latency of 2–4 s between actions | Unverifiable | Not found in its README |
| 32 | cj-elevate/tasker-mcp fixed all six findings of a Codex review | Verified | [CHANGELOG.md](https://github.com/cj-elevate/tasker-mcp/blob/master/CHANGELOG.md) |
| 33 | termux-app#5245: `--version` under proot-distro took 8.5 s | Verified (partly) | The issue is a feature request ("Proroot"). 8.5 s appears in it as a cold-start time, not as a `--version` run. |
| 34 | termux-app#2081: writing `termux.properties` as root changes its owner and breaks `RunCommandService` | Verified | The maintainer's comment in the issue on root ownership |
| 35 | Shizuku#2336 reports `rish` working on LineageOS with Android 16 | Unverifiable | The issue is "Minimum environment required for rish". No LineageOS mention was found. |
| 36 | Tasker 6.4.7-beta and later clears the clipboard on rooted phones with Shizuku | Unverifiable | Reddit report, not checked |
| 37 | Android 13+ needs `READ_LOGS` for Tasker's logcat clipboard events; Android 15 foreground services cannot get audio focus (Issue Tracker 375228130) | Unverifiable | Not checked. It is consistent with why the mic runs as uid 2000. |
| 38 | Claude Listen should be the only profile on Event 201 | Wrong | Claude Panel Gesture is meant to share the gesture (`build-claude-panel.py`) |

**Counts:** 38 claims.

| Status | Count | Notes |
|---|---|---|
| Verified | 21 | 2 of them only in part, and 2 already handled |
| Wrong | 6 | 1 of them only in part |
| Out of date | 5 | |
| Unverifiable | 6 | 1 of them only in part |

Not checked, and left as the report states them:
- the Reddit and community threads (r/selfhosted, r/tasker);
- ShizukuPlus #374 and #387;
- Tasker's known-issues page;
- the Android foreground-service documentation;
- Omarchy community projects.

**What this means for the report's argument.** Its picture of the phone stack is accurate. Its
weak points are mia, which it could not read and filled in with invented topic names, and staleness
from the repository split and 4.3.0. The recommendations that survive the fact-check are small,
concrete and mostly in android-assistant. They are drafted as issues; none has been filed yet.
