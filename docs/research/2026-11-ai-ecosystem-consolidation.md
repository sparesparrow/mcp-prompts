# Consolidating a personal AI-agent ecosystem across Android and Linux (November 2026)

> **Provenance.** This document is AI-generated. The source is a Gemini Deep Research report
> written in Czech on 2026-11-25 (about 41,000 characters). It came with an audio overview,
> "Proč AI agenti nepatří do mobilu" ("Why AI agents don't belong on the phone"), 5:55 long. Neither
> file is in this repository. The brief that started the run is the mcp-prompts template
> [`deep-research-ai-ecosystem-consolidation`](../../data/prompts/android-automation/deep-research-ai-ecosystem-consolidation.json).
> Claude translated and summarised the report and checked the load-bearing claims against primary
> sources where it could ([fact-check](#fact-check)). It also added its own
> [assessment](#claudes-assessment). Sections 1 to 7 follow the report's structure. They are a
> summary, not a translation. Unless a sentence says otherwise, the numbers and verdicts in them
> are the report's, not this project's.

**Research question.** One person runs a sprawling, overlapping AI-agent setup on a rooted Android
phone (aarch64) and on Linux. How should it be consolidated into one coherent, maintainable
architecture? Which layers, standards and tools should form the spine, and which should be dropped
or wrapped?

The setup described in the brief:
- Tasker with the AutoNotification, AutoInput and Join plugins.
- Eight AI chat apps plus NotebookLM.
- Termux with a Debian PRoot that runs six coding CLIs: Claude Code, Codex CLI, Qwen Code, Kiro
  CLI, Antigravity and Mistral Vibe.
- OpenClaw, Hermes Agent and Omarchy under consideration.
- An MCP server that drives the phone UI and the chat apps, the mcp-prompts library, Claude Code
  skills and subagents, Tasker tasks that start headless agents over ssh, ElevenLabs voice, and
  MQTT.

---

## Executive summary

The report argues for a **three-pillar hybrid architecture**, not one monolithic tool and not a
chain of UI macros:

1. **A single source of truth in Git**, built on the open standards that the Agentic AI Foundation
   (AAIF) stewards: `AGENTS.md`, Agent Skills (`SKILL.md`, agentskills.io) and stateless MCP
   (revision 2026-07-28).
2. **Hermes Agent** (Nous Research) on a dedicated, always-on Linux node, as the 24/7 orchestrator
   for messaging, cron and automation.
3. **OpenCode** as the primary terminal coding harness, on an API router (OpenRouter). Claude Code
   is kept only where a Claude Pro or Max subscription is meant to be used, through the official
   binary.

In this design, the rooted phone stops hosting six overlapping CLIs in PRoot and stops clicking
through chat apps. It becomes a **sensor and actuator edge**: Tasker plus AutoNotification plus
MQTT, reached over Tailscale.

The report gives two reasons for slimming down this hard:
- **Subscriptions are now separated from third-party tools.** Anthropic's documentation forbids
  offering Claude.ai login, or routing requests through Free, Pro, Max or Ultra plan credentials,
  in third-party apps. The report says server-side blocks hit clients such as OpenCode, OpenClaw
  and Goose between January and April 2026.
- **Agents fed with untrusted text are highly exploitable.** The report cites a ZeroLeaks audit
  of OpenClaw (a score of 2/100 and 91% prompt-injection success), two CVEs, and the Perplexity
  Comet audits by Brave, LayerX/Akamai and Trail of Bits, which showed silent exfiltration of email
  through indirect prompt injection.

The report also says what it could not find: no primary benchmarks or 2025–2026 specifications for
the Tasker/PRoot pipeline, LiteLLM, mcp-prompts, Kimi, Grok or NotebookLM. Its verdicts on those
rest on the protocols around them and on how Android and Linux work.

## Key recommendations

- **The three-pillar spine.** AGENTS.md, Agent Skills and MCP form the single source of truth in
  one private Git repository (the report calls it `agent-spine`). A sync script symlinks or
  generates each CLI's native files from it.
- **Hermes Agent on an always-on Linux node**, either a home mini-PC or a VPS at about USD 5 a
  month, in a container. It holds memory (FTS5 plus Markdown), cron, messaging gateways
  (Telegram or Signal with a strict `allowFrom`) and the MQTT link.
- **OpenCode plus OpenRouter** for every model that is not Anthropic's: DeepSeek, Kimi, Grok,
  Qwen, Mistral, and Gemini through the API. One key with a hard monthly spend cap.
- **Claude Code only through the official `claude` binary** on a Pro or Max plan, including
  `claude -p` over ssh. `CLAUDE.md` imports `@AGENTS.md`.
- **Android as an edge.** Tasker and AutoNotification capture events, turn them into structured
  JSON and publish them over MQTT, or a webhook over Tailscale, to the orchestrator. Join stays as
  a lightweight fallback for pushes. No LLM reasoning runs on the phone.
- **Retire the custom UI-driving MCP server and AutoInput as an LLM transport.** Keep AutoInput
  only for hand-started, deterministic macros in apps that have no API.
- **No `su` for agents.** No AI agent or MCP server may hold root, or unrestricted Accessibility
  or AutoInput control, over sensitive or system apps.
- **Omarchy as the interactive workstation**, not as the 24/7 host.
- **One secrets vault** (pass/age, or Secret Service on the desktop). Keys are passed only as
  short-lived environment variables. Separate Anthropic identities: the subscription for
  `claude`, and a capped Console API key for Hermes and OpenCode.
- **Merge mcp-prompts and the Claude skills into `SKILL.md` folders.** Keep mcp-prompts at most
  for dynamic, database-backed templates.
- **Retire or wrap the rest.** Codex CLI is wrapped as a reviewer (`codex mcp-server` or
  `codex-acp`) or retired. Antigravity, Kiro CLI, Qwen Code and Vibe are retired, except
  Antigravity for Google quotas and Kiro for AWS work. OpenClaw is not deployed. Comet is kept
  away from logged-in accounts.

## 1. Landscape map (2025–2026)

The report groups everything into seven layers and finds duplication in each:

| Layer | Current tools | Main alternatives | What the layer uniquely adds | Duplication |
|---|---|---|---|---|
| Model providers and routers | Gemini, Claude, ChatGPT, DeepSeek, Kimi, Grok, Perplexity | OpenRouter, AAIF Agent Router / agentgateway, OpenCode Zen, Obot Gateway, LiteLLM | One bill, model routing, price arbitrage, spend limits | A separate app account and CLI login per model |
| Agent CLIs and harnesses | Claude Code, Codex CLI, Qwen Code, Kiro CLI, Antigravity, Vibe, OpenCode | Goose (AAIF), Cursor CLI, Aider, Amp, Zed / JetBrains Junie | Repository work, worktrees, diffs, command sandboxing | All seven re-implement the same tool loop with incompatible config files |
| Orchestrators and multi-agent | OpenClaw, Hermes Agent | CrewAI, AutoGen, BeeAI, OpenAgents | 24/7 operation, cron and heartbeat, chat gateways, learning memory | OpenClaw and Hermes cover the same ground |
| Tools and protocols | Custom UI MCP, mcp-prompts, MCP, Claude Code skills and subagents | MCP Registry, A2A v1.0, editor ACP v1/v2, Open Responses, open-computer-use | Separates reasoning from tools (MCP), editor (ACP) and other agents (A2A) | mcp-prompts duplicates SKILL.md. The UI MCP bypasses official APIs and is brittle. |
| Knowledge and memory | NotebookLM, mcp-prompts, Claude skills | Hermes FTS5 + Honcho, OpenClaw MEMORY.md, Qwen auto-memory, Kiro knowledge bases | Long-term facts, preferences and procedures | Memory is scattered across incompatible files and a closed NotebookLM |
| Device automation and IoT | Tasker + plugins, ssh triggers, MQTT, ElevenLabs | Home Assistant (Hermes plugin), open-computer-use | Phone hardware, notifications, location, home and vehicle sensors | Join, ssh from Tasker, the UI MCP and MQTT all act as the same RPC bus |
| UI surfaces | 8 chat apps, Comet, Termux TUI, Omarchy | Telegram/WhatsApp/Signal via an orchestrator, Zed/JetBrains via ACP | The right input for the situation | Eight chat apps split attention. Comet duplicates search and adds exfiltration risk. |

Notes the report adds:
- **Routers.** API access is not the same as a consumer subscription. Claude Code, Antigravity and
  Kiro are bound to their vendors' billing and identity. The report says Google moved individual
  Gemini CLI users to the proprietary `agy` binary on 18 June 2026. Kiro signs in through AWS
  Builder ID, IAM Identity Center, GitHub or Google.
- **CLIs.** By autumn 2026 their capabilities are nearly equal:
  - OpenCode (MIT) is model-agnostic, with a plan mode, fine-grained allow/deny/ask permissions
    and session export and import.
  - Qwen Code 1.0 Preview speaks several APIs and runs a `qwen serve` daemon with ACP.
  - Vibe ships `vibe-acp`.
  - Kiro CLI v3 is strong on specs, steering and AWS MCP.
  - Antigravity is a closed Go binary that collects interaction data until you opt out.
  - Codex CLI shares `~/.codex/config.toml` across its surfaces and can act as an MCP server
    itself.
- **Orchestrators.** Hermes comes out ahead of OpenClaw. It has a closed learning loop that
  creates and refines Agent Skills, FTS5 session search, Honcho user modelling, isolated
  subagents, Python RPC tool scripting outside the context window, and a plugin catalogue pinned
  to reviewed commits. OpenClaw builds identity from SOUL.md, AGENTS.md, MEMORY.md and
  HEARTBEAT.md and, according to community guides, has no native agent-to-agent communication.
- **NotebookLM** has no documented MCP or CLI interface, so the report keeps it out of automated
  loops and uses it for manual synthesis.

## 2. Interoperability standards and their real adoption

**AAIF.** The report describes it as founded on 9 December 2025 under the Linux Foundation by
Anthropic, Block and OpenAI, with AWS, Google, Microsoft, Cloudflare and Bloomberg as platinum
members. Over time it has taken in MCP, AGENTS.md, goose, A2A, Agent Router, agentgateway, Open
Responses and, on 22 October 2026, Agent Skills.

**MCP.** The report counts five revisions between November 2024 and November 2026:
- **2025-03-26:** Streamable HTTP replaces HTTP+SSE, OAuth 2.1, and tool annotations.
- **2025-06-18:** batching removed, structured output and elicitation, RFC 9728 protected-resource
  metadata, and no token passthrough.
- **September 2025:** the MCP Registry preview.
- **2025-11-25:** OpenID Connect discovery and incremental consent.
- **2026-07-28:** a fully stateless core with no initialize handshake and no sessions. Every
  request carries its version and capabilities. Roots, Sampling and Logging are deprecated with a
  12-month window. OAuth is tightened with RFC 9207 `iss` checks and credentials bound to their
  issuer.

The roadmap points at more: MCP Apps, Tasks, and a file-transfer draft with no reference
implementation yet. All the CLIs surveyed handle stdio and remote HTTP, with quirks:
- Codex warns that it connects unauthenticated when no token is found.
- Kiro is rated "Partial": its web and mobile modes ignore `oauth` in `mcp.json`, and stdio needs
  absolute paths and an explicit `env.PATH`.

**A2A and IBM's ACP** merged under the Linux Foundation, and A2A reached v1.0. The report finds no
native A2A in personal CLIs. People link agents by exposing a CLI as an MCP server, or through the
editor ACP.

**The Agent Client Protocol** (editor to agent) is JSON-RPC over stdio, v1 stable and v2 in
preview. Zed and JetBrains host it. Vibe, Kiro v3, Antigravity, Qwen Code and an OpenClaw bridge
speak it, and adapters exist for Claude Code and Codex. Do not confuse it with IBM's ACP, or with
the Agentic Commerce Protocol.

**AGENTS.md** is the most portable instruction format. The report says more than 60,000
repositories use it.
- Read natively by Codex (including `AGENTS.override.md`), OpenCode, Antigravity and Vibe (after
  the folder is trusted).
- Claude Code reads it only when no CLAUDE.md is present, or when CLAUDE.md imports it.
- Qwen Code uses QWEN.md, and Kiro uses `.kiro/steering/*.md`.

**Agent Skills** has the fastest cross-vendor uptake. Anthropic's handover announcement reports
more than 70 platforms, 1 million published skills and nearly 280 million installs.
- Native in Claude Code, OpenCode, Antigravity, Qwen Code, Vibe and Hermes.
- Less clear for Codex (community loaders), Kiro (its own Skills and Powers) and OpenClaw
  (ClawHub).

**OpenAI-compatible APIs and routers** connect the model-agnostic tools (OpenCode, Qwen Code, Vibe,
Hermes, OpenClaw). They hit a wall with closed CLIs (agy, Kiro) and with Claude Code's consumer
login.

### Compatibility matrix (CLI × standard), as the report gives it

| Tool | MCP (stdio / HTTP / auth) | Editor ACP | A2A v1.0 | AGENTS.md / own rules | Agent Skills | OpenAI-compatible API / router |
|---|---|---|---|---|---|---|
| Claude Code | Native, stdio + HTTP | Via `claude-agent-acp` adapter | Unconfirmed | Conditional (import `@AGENTS.md` in CLAUDE.md) | Native (originator) | Only Anthropic API, Bedrock, Vertex or LLM gateways |
| Codex CLI | Native (`config.toml`, stdio + HTTP + OAuth/bearer), also `codex mcp-server` | Via `codex-acp` adapter | Unconfirmed | Native (`AGENTS.override.md` → `AGENTS.md`) | Agent profiles + community loaders | OpenAI natively. Arbitrary router unconfirmed. |
| OpenCode | Native (`opencode.json`, stdio + remote HTTP + `opencode mcp auth`) | Unconfirmed | Unconfirmed | Native (global + tree) | Native | Fully agnostic (OpenRouter, own API, Zen) |
| Antigravity (agy) | Native (`mcp_config.json`) | Native | Unconfirmed | Native (AGENTS.md and GEMINI.md) | Native (`/skills`, plugins) | Closed Google selection (Gemini, Claude, GPT-OSS) |
| Qwen Code | Native client | Native (`qwen serve`, Qwen Code Claw) | Unconfirmed | Own QWEN.md (AGENTS.md unconfirmed) | Native | Multi-protocol (OpenAI, Anthropic, Gemini, Qwen, Ollama/vLLM) |
| Kiro CLI v3 | Partial (absolute paths for stdio, no OAuth from JSON in web and mobile modes) | Native (Zed, JetBrains) | Unconfirmed | Own `.kiro/steering/*.md` | Own Skills + Powers (agentskills.io match unconfirmed) | AWS / auto model choice |
| Mistral Vibe | Native (`config.toml`) | Native (`vibe-acp`) | Unconfirmed | Native (after folder trust) | Native (`~/.vibe/skills/`, `.agents/skills/`) | Any OpenAI-compatible endpoint |
| Hermes Agent | Native client + pinned plugins | Unconfirmed | Unconfirmed | Own context and memory (`~/.hermes/`) | Native agentskills.io + self-evolution | 200+ models via OpenRouter, Nous, OpenAI, Anthropic |
| OpenClaw | Native client | Native ACP bridge | No agent-to-agent communication | Own AGENTS.md + SOUL.md + MEMORY.md | Own Skills + ClawHub | Agnostic (Anthropic API, OpenAI login, Gemini, Ollama) |

## 3. Consolidation strategies

| Strategy | Principle | Main benefit | Failure modes | Cost and ToS risk | Lock-in |
|---|---|---|---|---|---|
| (a) One primary CLI, the others as MCP tools or subagents | One harness calls the rest through `codex mcp-server` or ACP | Least switching while coding, precise control of diffs | No 24/7 daemon or chat channels. Nested agents bring latency and timeouts (Codex's default MCP start-up timeout is 10 s). | Good for flat-rate Claude Code or Codex. Many MCP servers bloat context. | Medium |
| (b) A router in front of all models | One OpenAI-compatible endpoint | One bill, easy model swaps | Solves neither memory, skills nor tool permissions. The gateway is a single point of failure. | Pay as you go. A Claude consumer plan cannot legally be plugged in. | Low |
| (c) An orchestrator on top (Hermes or OpenClaw) | A 24/7 daemon for messages, memory, cron and flows | A real personal assistant, independent of an open terminal | A larger prompt-injection surface (critical reported findings for OpenClaw). Worse for deep code edits. | Background token use, needs API keys | Low (Hermes), medium (OpenClaw) |
| (d) A shared source of truth with sync | Git repo of AGENTS.md, SKILL.md and an MCP manifest, generating each CLI's config | Knowledge instantly portable between tools | The lowest common denominator misses specifics such as Kiro steering and Codex profiles | Near zero. Saves re-explaining. | Very low |

The report's conclusion: no single strategy covers everything. (d) is the mandatory base, with (a),
(b) and (c) combined on top. The orchestrator should not also hold full developer access to source
code, because that widens the damage if it is abused. The report also mentions attempts to bridge
subscriptions into third-party tools (`claude setup-token`, delegating to the local binary). It
says these put the whole account at risk.

## 4. Mobile specifics on a rooted Android phone

- **Termux and PRoot.** PRoot only emulates a root filesystem in user space. It has no kernel
  namespaces (so no Docker or Podman sandbox), no systemd, no system keyring for OAuth flows, and
  system calls are costly. Hermes itself warns that its standard Linux installer is not meant for
  Termux. The report's advice: use Termux as a thin client (ssh, mosh, tmux, Tailscale) to a real
  Linux machine.
- **Tasker, AutoNotification and Join make an excellent deterministic event bus, once LLM
  reasoning is taken out of it.** Tasker catches the event (location, car Bluetooth, battery,
  notifications), turns it into JSON, and publishes it over MQTT or an authenticated Tailscale
  webhook to the orchestrator. Join stays as a fallback for pushes.
- **UI automation through Accessibility, AutoInput or a custom UI MCP is the most brittle part.**
  It breaks with every layout change, takes over the screen, adds tens of seconds of latency, has
  no reliable structured tool calls, and may break terms that forbid scripted access to consumer
  apps. The report cites §3.7 of Anthropic's consumer terms as an example. LLM requests from the
  phone should go through an API, or over ssh to a legitimate CLI. The report says `claude -p`
  over ssh on your own machine complies with Anthropic's terms.
- **Battery and background.** Doze and app standby kill long-running daemons. Keeping agents
  alive in PRoot either drains the battery through wakelocks or drops connections silently. The
  report's fix is to invert the design: the agent and the MQTT broker live on a network Linux node,
  and Tasker wakes the phone only when an event happens.
- **Root.** If an agent reachable through Termux, Tasker or MCP can use `su`, or unrestricted
  Accessibility, then one indirect prompt injection in a message, notification or email can break
  the Android sandbox. It can read 2FA codes, open app databases or operate banking apps. The
  report's rule: no agent and no MCP server ever holds `su`.

## 5. Omarchy as a node

The report calls Omarchy, DHH's Arch, Hyprland and Quickshell setup, a very good **interactive
desktop node** but a poor sole host for 24/7 orchestration.
- **For it:** a real kernel, systemd, containers, fresh Arch packages, and keyboard-driven tiling
  that suits terminal agents.
- **Against it:** it is an "omakase" developer workstation. Some in the community criticise its
  wget-and-eval install chain. Rolling updates, kernel restarts and laptop sleep interrupt
  services. Mixing an always-connected agent that receives external messages with a desktop that
  holds a logged-in browser, ssh keys and repositories is bad for security.

The proposed split: Omarchy for interactive development, and Hermes, the MQTT broker and remote MCP
servers on an always-on mini-PC or a VPS of about USD 5 a month. State is shared in four separate
flows:
1. Config, rules and skills in one private Git repository, pulled on every node and symlinked
   into place.
2. Tools over stateless Streamable HTTP MCP inside Tailscale, never on the public internet. The
   stateless core means a switch between Wi-Fi and mobile data does not break a session.
3. Long-term memory held centrally by Hermes.
4. Coding sessions moved with tmux over mosh, or with `opencode export` and `opencode import`.

## 6. Security and governance

- **Secrets.** Every CLI keeps credentials somewhere else: keyrings, `~/.vibe/.env`,
  `bearer_token_env_var` in Codex, `~/.kiro/settings/mcp.json`, `QWEN_SERVER_TOKEN`. Project
  files in someone else's repository (`.codex/config.toml`, `AGENTS.md`) can start local stdio
  programs with your rights. The report's rules:
  - Never keep secrets in repositories or in AGENTS.md.
  - Use one vault and pass keys as short-lived environment variables.
  - Set hard spend caps on OpenRouter.
  - Check that an empty Codex token variable does not lead to unauthenticated calls.
  - Keep the Anthropic subscription and the API key separate.
- **Prompt injection from the screen, notifications and the web** is the gravest risk. Models do
  not reliably separate data from instructions. The Comet audits showed that opening a crafted
  link, or summarising a page with a hidden comment or a fake CAPTCHA, could make the agent open
  Gmail, encode messages in Base64 and send them out. The report says OpenAI admitted in December
  2025 that AI browsers may stay vulnerable for good. AutoNotification carries the same vector.
  Three rules follow:
  1. Strict sender allowlists in chat gateways.
  2. Untrusted text is processed only by a stateless model with no shell, file, MCP-write or
     Tasker rights.
  3. Every state-changing action needs human confirmation with a clear preview.
- **Least privilege.** Per MCP 2025-06-18 and 2026-07-28:
  - No token passthrough.
  - Validate `aud` and `iss`.
  - Keep separate upstream credentials.
  - Keep SDKs patched. The report cites GHSA-qx49-fqc8-xw99, a September 2026 advisory for the
    MCP Python SDK about a leak of the PKCE verifier and code to a malicious server.
  - Give every client explicit tool allowlists and output limits.
  - Run the orchestrator in a container with no access to `~/.ssh` or browser cookies.

## 7. Target architecture and migration

### Layer map (top to bottom)

| Layer | Components | Node | Communication |
|---|---|---|---|
| 6. Interfaces and events | Telegram or Signal, ElevenLabs voice, Omarchy TUI, Termux (ssh/mosh), Tasker + AutoNotification + MQTT | Android + Omarchy | Commands and JSON events over Tailscale, MQTT over TLS, or the Telegram API |
| 5. Orchestration and coding | Hermes Agent (24/7), OpenCode (main bring-your-own-key CLI), Claude Code (only for Pro/Max) | VPS or mini-server (Hermes), Omarchy (CLIs) | Hermes listens to messages and MQTT and calls MCP. The phone reaches the CLIs over ssh/mosh. |
| 4. Protocols and tools | Stateless MCP servers (Streamable HTTP + stdio), optionally `codex mcp-server` and editor ACP | Omarchy + VPS | Local tools over stdio, remote ones (Home Assistant, IoT, shared workspace) over HTTP inside Tailscale |
| 3. Single source of truth | `agent-spine` Git repo: AGENTS.md, `skills/*/SKILL.md`, MCP templates, Hermes memory | Git, cloned to every node | Versioned. A sync script makes the symlinks and the `@AGENTS.md` import. |
| 2. Model router and auth | OpenRouter (DeepSeek, Kimi, Grok, Qwen, Mistral, Gemini API) + separate Anthropic OAuth for `claude` only | Cloud + local vault | OpenCode and Hermes use one capped key. Claude Code keeps its own official auth. |
| 1. Compute nodes and isolation | Rooted Android (no `su` for agents), Omarchy (containers for tests), USD 5 VPS (container sandbox) | Devices + Tailscale mesh | Tailscale is the only bus. No orchestrator or MCP port is public. |

### Keep, merge, wrap or retire (the report's verdicts)

| Component | Verdict | Role |
|---|---|---|
| Hermes Agent | Keep, as the spine | 24/7 orchestrator |
| OpenCode | Keep, as the primary CLI | Coding over OpenRouter |
| Claude Code | Keep, conditionally | Only with an active Pro/Max plan, through the official binary |
| Omarchy | Keep, as the desktop node | Plus a small always-on server |
| Tasker + AutoNotification + Join + MQTT | Keep | Event bus and IoT spine into Hermes |
| NotebookLM | Keep, separately | Manual document synthesis |
| ElevenLabs | Wrap | Voice I/O adapter for Hermes |
| Tasker → headless ssh agents | Keep, rewire | One secured call to a Hermes webhook or `claude -p` on a server |
| Claude skills, subagents and mcp-prompts | Merge into the single source of truth | `SKILL.md` and AGENTS.md. mcp-prompts dropped, or kept only for dynamic templates. |
| Codex CLI | Wrap or retire | Reviewer through `codex mcp-server` or `codex-acp` |
| Termux + Debian PRoot | Slim down | Thin client only. Stop running agent CLIs in PRoot. |
| Custom UI MCP + AutoInput for chatbots | Retire as an LLM transport | AutoInput only for manual macros in non-AI apps |
| Antigravity, Kiro, Qwen Code, Vibe | Retire | Models through OpenRouter. Exceptions: agy for Google quotas, Kiro for AWS. |
| Chat apps and Comet | Retire from automation | Manual use at most. Comet away from logged-in accounts. |
| OpenClaw | Do not deploy | Duplicates Hermes and has a poor security record |

### Migration

The report plans three phases:
1. **Stabilise and secure:** the Git source of truth, one vault, OpenRouter, and switching off the
   UI control of chat apps.
2. **Centralise on Linux:** Hermes in a container on an always-on node, and OpenCode on Omarchy,
   linked over Tailscale and stateless MCP.
3. **Clean up the edges:** convert mcp-prompts and the skills to `SKILL.md`, put Tasker, MQTT and
   ElevenLabs behind one Hermes entry point, and remove the PRoot CLIs and the surplus apps.

The first five steps:
1. Create the `agent-spine` repository with a shared AGENTS.md and a `skills/` folder in the
   agentskills.io layout. Move the main procedures from mcp-prompts and `~/.claude/skills/` into
   it, and add `@AGENTS.md` to CLAUDE.md.
2. Create one OpenRouter key with a monthly cap for every non-Anthropic model. Keep the Claude
   subscription for the official binary only. Keep every key in a vault, never in `config.toml` or
   `mcp.json` in a repository.
3. Install OpenCode on Omarchy, configure only the MCP servers it needs, with restrictive
   allow/deny/ask permissions, and check that it loads AGENTS.md. Stop using Qwen Code, Vibe, Kiro
   and agy in the phone's PRoot.
4. Deploy Hermes in a container on an always-on node in the Tailscale network. Enable only
   Telegram or Signal, with `allowFrom` set to your own id, and connect the existing MQTT broker.
5. Switch off the MCP server that drives chat apps through UI automation. Remove every `su` call
   from paths that agents can reach through Tasker and Termux. Make Tasker and AutoNotification
   send only filtered JSON events over Tailscale/MQTT, with human confirmation before every
   state-changing action.

---

## Claude's assessment

### Where we agree

- **One source of truth for rules and skills.** Rules, skills and MCP config are copied by hand
  between CLIs today, and the copies drift. Agent Skills is now an AAIF standard, and Claude Code
  reads `AGENTS.md` (see the fact-check). Generating each CLI's files from one repository is
  cheap and removes a whole class of drift. Tracked as [#139](https://github.com/sparesparrow/mcp-prompts/issues/139).
- **Tasker as a deterministic event bus over MQTT.** This fits what is already here: mosquitto
  runs, the MIA topics are allowlisted, and `notif-wait.py` already replaces polling with a
  notification hook. Moving from "agent reads the screen" to "Tasker emits structured events" is
  the right direction. Tracked as [#140](https://github.com/sparesparrow/mcp-prompts/issues/140).
- **No `su` in agent paths.** The android-assistant MCP server
  ([android-assistant](https://github.com/sparesparrow/android-assistant)) already has no shell and no `su`.
  Root remains in maintenance scripts. `tasker-edit.py` reads and writes Tasker's files with `su`
  over adb, and its writes are gated: they run only in an interactive session after the user's
  yes to the exact change, and a headless, agent-started or Tasker-started run returns the
  commands instead. `phone-services ensure` uses `su` to start the mic server, and it is not only
  started by a person: `run-agent.sh` and the watch loop call it automatically. Removing `su` from
  those automatic paths is tracked in [#143](https://github.com/sparesparrow/mcp-prompts/issues/143).
- **Screen text is data, and state changes need a yes.** The confirmation-token design (preview,
  one-time token, 5-minute expiry) matches the report's rule 3. Its rule 2, that untrusted text is
  processed only by a model without tools, is stricter than what we do today: the agent that
  reads a chat reply can still call `act`. That gap is worth closing for the headless agents.
- **Battery and Doze.** Long jobs should end on a notification or event, not on a loop that keeps
  the phone awake.
- **An always-on Linux node and remote MCP over Tailscale, with auth.** These are on the roadmap
  ([#141](https://github.com/sparesparrow/mcp-prompts/issues/141)). The 2026-07-28 stateless revision makes MCP over mobile networks much less fragile.

### Where we deliberately disagree

**"Switch off the MCP server that drives chat apps through UI automation."** We keep it, scoped
and gated. The report's risks are real:

- **Prompt injection.** A chat answer, a web page summarised by an app, or a notebook source can
  carry instructions. That is the Comet lesson.
- **Terms of service.** Anthropic's consumer terms (§3, item 7) forbid accessing its services
  "through automated or non-human means, whether through a bot, script, or otherwise" except with
  an API key or explicit permission. Other providers have similar clauses. Driving the Claude app
  itself this way would plainly conflict with that clause, so the drivers do not cover the Claude
  app: Claude is used through the official `claude` binary. For the other apps, each provider's
  terms still need a review ([#143](https://github.com/sparesparrow/mcp-prompts/issues/143)).
- **Brittleness.** Every app update can break a driver. We have already seen hidden composers and
  unlabelled buttons.

On the other side is value an API cannot replace:

- **Subscriptions already paid for.** Gemini, ChatGPT, Perplexity and others come with consumer
  plans. API access to the same models is billed again, separately.
- **App-only tools.** Gemini Deep Research reports and NotebookLM audio overviews are what
  produced this very document, and NotebookLM has no documented public API. ChatGPT and Perplexity
  research modes, and DeepSeek DeepThink with app-side search, fall in the same group.
- **A second opinion from a different model family**, with Claude verifying each point. This
  improves reviews in practice (scenario 4.2 in [docs/10](../10-android-automation.md)).

We keep the risks bounded this way, and the hardening backlog extends it:

1. **Consent gates.** Nothing reaches another person, and no Tasker task or non-light MQTT topic
   runs, without a preview and the user's yes. `send=false` drafts leave the final send to the
   user.
2. **The one-screen lock.** Phone-driving agents run one at a time under `state/agent.lock`, so
   two agents can never interleave taps.
3. **Answers are data.** Every tool that returns app text says so, and agents report advice; they
   do not act on it. Next step: headless advisor agents lose `act` after the brief is sent ([#143](https://github.com/sparesparrow/mcp-prompts/issues/143)).
4. **Notification hooks instead of screen polling** for long jobs (`notif-wait.py`).
5. **No `su`, no shell, no installs and no permission grants** in any agent tool.
6. **Self-contained briefs without secrets.** Nothing private is sent to a provider beyond what
   the user asked for.
7. **Fixture tests and an evaluation rubric** (`android-app-agent-eval`) so breakage after an app
   update is caught, not guessed. Tracked as [#142](https://github.com/sparesparrow/mcp-prompts/issues/142).

**"Retire mcp-prompts in favour of SKILL.md."** We disagree in part. Skills and prompts overlap,
but mcp-prompts gives something a folder of skills does not: templates with typed variables,
profiles that limit a listing to one kind of work, and one server that every MCP client can query,
including clients with no skill support. The plan is to generate both from one source ([#139](https://github.com/sparesparrow/mcp-prompts/issues/139)),
not to drop either.

**"Stop running agent CLIs in PRoot."** We agree about the six overlapping CLIs. We disagree about
Claude Code. Running Claude Code on the phone is the whole point of the phone as an assistant: the
voice pipeline and Tasker tiles call `claude -p` locally, with the user's own login, on the device
that holds the screen. A remote node will take over the 24/7 jobs, but the phone keeps one local
harness.

## Fact-check

Checked on 2026-11-25 by Claude with web search and fetch, using primary sources where available.
**Status:** *verified* means a primary or authoritative source confirms the claim; *partly
verified* means part is confirmed and part is not; *doubtful* means a source contradicts it;
*unverified* means no source was found either way.

| # | Claim in the report | Status | Source and note |
|---|---|---|---|
| 1 | AAIF was founded on 9 December 2025 under the Linux Foundation by Anthropic, Block and OpenAI, and stewards MCP, AGENTS.md and goose | Verified | [Linux Foundation press release](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation). Later additions (A2A, agentgateway, Open Responses) were not each checked. |
| 2 | MCP revision 2026-07-28 has a stateless core: no initialize handshake, no sessions, version and capabilities per request; Roots, Sampling and Logging deprecated with a 12-month window; RFC 9207 `iss` validation | Verified | [MCP blog, 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/): "retired the `initialize`/`initialized` exchange along with the `Mcp-Session-Id` header". The blog does not state how long older revisions stay supported, so the report's transition-period claim for old servers is unverified. |
| 3 | Agent Skills (SKILL.md, agentskills.io) was handed to AAIF on 22 October 2026, with more than 70 platforms, 1 million skills and nearly 280 million installs | Verified | [Anthropic announcement](https://www.anthropic.com/news/donating-agent-skills-to-the-agentic-ai-foundation). The adoption figures are Anthropic's own. |
| 4 | Anthropic does not permit third-party apps to offer Claude.ai login or to route requests through Free, Pro, Max or Ultra credentials | Verified | [Claude Code legal and compliance](https://code.claude.com/docs/en/legal-and-compliance): "Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, Max, or Ultra plan credentials on behalf of their users." The server-side blocks from January 2026 are reported by the press ([The Register](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access)), not confirmed by Anthropic. |
| 5 | Consumer terms §3.7 forbid scripted access outside the API | Verified | [Anthropic consumer terms](https://www.anthropic.com/legal/consumer-terms), §3 item 7: no access "through automated or non-human means, whether through a bot, script, or otherwise" except with an API key or explicit permission. |
| 6 | Claude Code reads AGENTS.md only when there is no CLAUDE.md, or through an `@AGENTS.md` import | Verified | [Claude Code memory docs](https://code.claude.com/docs/en/memory#agents-md): with both files present, Claude reads "Your `CLAUDE.md` files only" by default. A setting can change this. |
| 7 | OpenClaw CVE-2026-25253 | Verified | [NVD](https://nvd.nist.gov/vuln/detail/CVE-2026-25253) and [OSV](https://osv.dev/vulnerability/CVE-2026-25253): OpenClaw before 2026.1.29 took a `gatewayUrl` from the query string and opened a WebSocket sending its token (1-click token theft). Fixed in 2026.1.29. |
| 8 | OpenClaw CVE-2026-22708 | **Doubtful (misattributed)** | The [CVE record](https://nvd.nist.gov/vuln/detail/CVE-2026-22708) is for **Cursor**: "Terminal Tool Allowlist Bypass via Environment Variables", fixed in Cursor 2.3. It is a prompt-injection issue, but not OpenClaw's. |
| 9 | ZeroLeaks audit: OpenClaw scored 2/100 with 91% prompt-injection success | Partly verified | Reported by [The Decoder](https://the-decoder.com/openclaw-formerly-clawdbot-and-moltbook-let-attackers-walk-through-the-front-door/) for a January 2026 test with Gemini 3 Pro as the model (Opus 4.5 scored 39/100 in the same test). The original ZeroLeaks report was not found. The score depends on the model, so it is not a property of OpenClaw alone. |
| 10 | Perplexity Comet prompt-injection audits by Brave, LayerX/Akamai and Trail of Bits | Verified, with a correction | [Brave](https://brave.com/blog/comet-prompt-injection/) (August 2025), [LayerX CometJacking via Akamai](https://www.akamai.com/blog/security/2025/oct/cometjacking-how-one-click-can-turn-perplexitys-comet-ai-browser-against-you) (October 2025), and [Trail of Bits](https://blog.trailofbits.com/2026/02/20/using-threat-modeling-and-prompt-injection-to-audit-comet/) (Gmail exfiltration with four techniques). The Trail of Bits post is from February 2026, but the audit itself was in April 2025, before launch, and Perplexity says those gaps were closed before launch. The report presents it as a February 2026 audit. |
| 11 | Omarchy is x86_64-only | **Out of date** | Up to 4.0.x, the ISO and packages were x86_64. [Omarchy 4.5.0](https://github.com/omacom/omarchy/releases/tag/v4.5.0) (5 November 2026) ships an aarch64 ISO, a native install on M1, M2 and M3 MacBooks and "preliminary" support for NVIDIA ARM machines, and its [release notes](https://omarchy.org/news/2026/11/omarchy-4-5/) say Snapdragon support is coming. Neither mentions phones or Android. Correct wording: "x86_64-first, with new and limited ARM laptop support". |
| 12 | IBM's ACP merged into A2A under the Linux Foundation | Verified | IBM Research and Google announced it in August 2025 (see [IBM's ACP page](https://research.ibm.com/projects/agent-communication-protocol)). A2A's version number (1.0) was not checked. |
| 13 | Hermes Agent warns that its standard installer is not for Termux | Partly verified | The [Hermes Agent README](https://github.com/NousResearch/hermes-agent) points Android users to a separate Termux guide and a curated `[termux]` extra. So it supports Termux through its own path. That is softer than "not meant for Termux". |

Not checked (left as the report states them): star counts, OpenCode's PR history, Codex v0.143.0
details, the Kiro "Partial" rating at clients.dev, GHSA-qx49-fqc8-xw99, OpenAI's December 2025
remark on AI browsers, and the Google `agy` move on 18 June 2026.

What this means for the report's argument: the two OpenClaw points are weaker than stated. One of
the two CVEs belongs to Cursor, and the audit score depends on the model. The conclusion, that an
always-on agent fed with untrusted text needs strict isolation, still stands on the verified
evidence: CVE-2026-25253 and the Comet findings.
