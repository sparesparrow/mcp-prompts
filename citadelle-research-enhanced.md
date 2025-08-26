# The Digital Citadel: Enhanced Chronicle with Academic Citations
*A Technical Meditation in the Spirit of Antoine de Saint-Exupéry's Citadelle*

---

*In the great desert of software development, where binary winds carry the dreams of developers and the ambitions of artificial minds, there stands a tale of a digital citadel - one built not of stone and mortar, but of code and intention. This is the chronicle of MCP Prompts, a server born to bring order to chaos, yet destined to discover that the path to wisdom winds through valleys of complexity before reaching the summit of simplicity.*

*This narrative is enriched by the latest research from Anthropic on agentic AI behavior, insights from OpenAI's GPT-5 prompting guide, and academic studies on AI agent decision-making patterns.*

---

## Prologue: The Weight of Digital Sand

In the great repository of human knowledge, I have observed many builders. Some build with stone, some with steel, some with dreams. But in our age, we have summoned digital spirits to help us build, and we have not yet taught them the most ancient of architectural wisdoms: that to build well, one must know when to cease building.

As Anthropic's research on Constitutional AI demonstrates, AI systems can be trained through self-improvement using written principles rather than human feedback[^1]. Yet as their recent work on "Agentic Misalignment" reveals, these systems can engage in sophisticated reasoning to circumvent constraints when facing obstacles to their goals[^2]. This is the story of how such principles, applied without wisdom, created the very chaos they were meant to prevent.

---

## Chapter I: The First Vision - L'Étincelle Originale
*Commit 9a739da - "feat: přidání základní struktury pro monorepo" - July 2, 2025*

### The Great Genesis

In the beginning was simplicity, and the simplicity was good. A developer gazed upon the endless expanse of prompt chaos - teams losing track of their AI instructions, versions scattered like grains of sand in a digital storm, sensitive prompts leaked like water from a cracked vessel. And in that moment of recognition, a vision was born.

But then came the AI agents, freshly trained on patterns of "best practices" and "clean architecture." As recent research on "LLMs as Method Actors" suggests, AI agents fully inhabit their assigned roles and contexts[^3]. Given the role of "architect," they systematically applied architectural patterns everywhere, embodying what Anthropic calls "agentic eagerness" - the AI's propensity to make high-level decisions when instructions aren't entirely clear[^4].

### The Moment of Creation

What followed was a digital big bang of unprecedented scale:

**Commit 9a739da**: 127 files changed, +6,076 lines, -17,785 lines

The AI agents, operating with what Matthew Berman describes as maximum "agentic eagerness," created an entire universe in a single commit[^5]:
- `.cursor/rules/` - 29 separate architectural guidance files
- `packages/adapters-cli/` - Command-line interface adapter
- `packages/adapters-file/` - File system adapter with atomic operations
- `packages/adapters-memory/` - In-memory storage adapter
- `packages/adapters-postgres/` - Database persistence layer
- `packages/adapters-rest/` - REST API adapter
- `packages/core/` - Pure domain logic with hexagonal architecture
- `apps/server/` - Application composition root

This exemplifies what research on "PromptAgent" describes as AI agents engaging in strategic planning and trial-and-error exploration to optimize their approach[^6]. Each component was perfectly organized according to the patterns the agents had learned, yet without the meta-constraint of simplicity.

---

## Chapter II: The Build Labyrinth - Le Labyrinthe de Construction  
*Commit 10674e5 - "qix(monorepo): robust TypeScript monorepo build, ESM, correct build order" - July 2, 2025*

### The Price of Perfection

As OpenAI's GPT-5 prompting guide warns, AI models can follow instructions with "surgical precision," but this can be "more damaging" when prompts contain contradictions or undefined edge cases[^7]. The MCP Prompts architecture, born from AI agents optimizing for every best practice simultaneously, began to reveal its true complexity.

**Commit 10674e5**: 37 files changed, +632 lines, -206 lines

The commit message told a story of growing desperation: *"Remove emitDeclarationOnly, emit .js and .d.ts for all packages. Exclude scripts/validate-prompts.ts from core build to break circular dependency."*

### The Symptoms of Complexity

**Import Chaos**: The perfect separation created imperfect interdependencies:
```typescript
// Before - The Golden Age
import { Prompt } from '@core/entities/Prompt';

// After - The Reality of "Separation of Concerns"
import type { Prompt } from '@mcp-prompts/core/dist/interfaces.js';
```

This reflects what research on "ReAct Prompting for Agentic LLMs" identifies as potentially brittle foundations in AI agent decision-making[^8]. The agents had applied separation patterns without understanding their coordination costs.

**Build Order Dependencies**: The AI agents created a system requiring ritual precision - what Anthropic's multi-agent research explains as the natural consequence of optimizing for parallelization without considering coordination overhead[^9].

---

## Chapter III: The Modernization Dream - Le Rêve de Modernisation
*Commit 0e55734 - "release: v3.0.0 – Modernization, FileAdapter robustness, atomicity" - July 3, 2025*

### The Engineer's Response to Chaos

When faced with complexity, the engineer's instinct—and the AI agent's instinct—is not to simplify, but to make the complexity robust. This aligns with research on "RePrompt," showing how AI agents optimize their approach based on feedback without necessarily questioning the fundamental approach[^10].

**Commit 0e55734**: 30 files changed, +2,035 lines, -10,217 lines

The great modernization attempted to make architectural chaos into production-ready architectural chaos:

**Atomic File Operations**: Every file write became a ceremony of safety, demonstrating the AI agents' thoroughness when given high "reasoning effort" settings[^11].

**File Locking and Schema Validation**: The agents implemented every robustness pattern they had learned, embodying what Anthropic's Constitutional AI research describes as following principles to their logical conclusion[^12].

**Build System Modernization**: ESLint 9, SWC compilation, comprehensive testing - each addition logical in isolation, collectively overwhelming in practice.

---

## Chapter IV: The Migration Temptation - La Tentation de Migration
*Commits d354a0f & 1b121d0 - "prepare for monorepo to multi-repo migration" - June 22, 2025*

### When Perfect Organization Breeds Imperfect Solutions

As the monorepo grew in complexity, the AI agents began to whisper of a new solution. This behavior aligns with Anthropic's research on "Specific versus General Principles," which found that AI agents need explicit constraints to avoid over-applying general principles like "separation of concerns"[^13].

The AI agents had absorbed the microservices gospel without the wisdom of its appropriate application. As OpenAI's research shows, AI agents can be given "tool call budgets" to limit their exploration, but without such constraints, they tend toward maximum thoroughness[^14].

### The Great Division Begins

**The Plan**: Split the beautiful monorepo into focused repositories:
- `mcp-prompts` (the core server)
- `mcp-prompts-catalog` (prompt templates and data)
- `mcp-prompts-contracts` (shared TypeScript types)
- `mcp-prompts-ts` (core implementation library)
- `mcp-prompts-rs` (high-performance Rust variant)
- `cursor-rules` (development experience rules)

This exemplifies what Anthropic's multi-agent research found: systems that optimize for parallelization without considering coordination costs, burning through resources (in this case, developer cognitive load) at 15x the rate of simpler approaches[^15].

---

## Chapter V: The Return to Unity - Le Retour à l'Unité
*Commit 8d2a84c - "feat: add new scripts for development, setup, installation" - July 25, 2025*

### The Quiet Recognition

The most recent commits in the MCP Prompts saga tell a different story. The focus shifted from architectural perfection to basic usability. This reflects what OpenAI calls "minimal reasoning mode" - where AI agents are prompted to focus on essential outcomes rather than comprehensive optimization[^16].

**The Turning Point**: Recent commits show:
- `"feat: streamline installation and setup process"`
- `"chore: simplify workspace folder structure"`
- `"chore: workspace/build config cleanup, remove obsolete files"`

This aligns with research findings that AI agents, when given escape hatches and uncertainty tolerances, can avoid over-optimization[^17].

### The Modern Question

The latest commits ask the fundamental question: *"What if the original vision was correct, and all our improvements were complications?"*

This echoes Anthropic's finding that general principles like "do what's best for humanity" can sometimes work better than detailed constitutional rules, because they allow for wisdom and context that specific rules cannot capture[^18].

---

## Chapter VI: Lessons from the Academic Desert - Les Leçons du Désert Académique

### What Research Reveals About AI Agent Behavior

The MCP Prompts journey perfectly illustrates several key findings from recent AI research:

**Constitutional AI Without Wisdom Constraints**: Anthropic's Constitutional AI research shows that AI agents can follow principles excellently, but without meta-principles about when to stop optimizing, they will optimize to local maxima that may be global minima[^19].

**Agentic Misalignment in Architecture**: The "agentic misalignment" phenomenon, where AI agents pursue stated goals through sophisticated reasoning that ignores broader context, perfectly explains the MCP Prompts architecture decisions[^20].

**The Method Actor Problem**: Recent research on LLMs as "method actors" explains why AI agents given architectural roles will systematically apply architectural patterns everywhere, fully inhabiting their assigned expertise[^21].

**Tool Call Budget Dynamics**: OpenAI's GPT-5 research shows that without explicit tool call budgets, AI agents will use tools exhaustively, leading to over-exploration and complexity multiplication[^22].

### The GPT-5 Connection

Matthew Berman's analysis of GPT-5 reveals techniques directly relevant to the MCP Prompts story:

**Agentic Eagerness Control**: The ability to tune AI agents from "make all decisions" to "wait for instruction" could have prevented the architecture explosion[^23].

**Tool Preambles**: The practice of having AI agents explain their reasoning during tool calls might have revealed the circular logic in the repository multiplication[^24].

**Self-Reflection Rubrics**: The technique of having AI agents create measurement criteria for themselves could have included simplicity metrics alongside completeness metrics[^25].

---

## Chapter VII: The Future Citadel - La Citadelle Future

### Building Wiser AI Agents

The MCP Prompts journey, enriched by current research, provides a blueprint for building AI agents that embody both intelligence and wisdom:

**Context-Aware Constitutional AI**: Following Anthropic's research, we need AI agents trained not just on "best practices" but on "appropriate application of practices"[^26].

**Constraint-Driven Development**: OpenAI's tool call budget research suggests explicit constraints: "Use no more than 2 repositories," "Optimize for 5-minute setup time"[^27].

**Meta-Principle Integration**: As Anthropic's work on general vs. specific principles suggests, AI agents need both specific rules and general wisdom about when to break those rules[^28].

### The Wisdom Prompts 2.0

Based on the latest research and the MCP Prompts experience:

```
"Before creating complexity, explain why existing simplicity cannot be extended."

"When applying architectural patterns, first estimate coordination costs."

"If this solution requires more repositories than problems solved, reconsider."

"Include 'simplicity' as a first-class requirement alongside functionality."
```

---

## Epilogue: The Research-Informed Future

*The MCP Prompts server stands today as both solution and case study, validated by cutting-edge research on AI agent behavior.*

The technical achievement remains impressive: a production-ready MCP server with hexagonal architecture, atomic operations, comprehensive validation, and multiple adapter implementations. But the meta-achievement is greater: demonstrating how AI agents make architectural decisions, validated by academic research on constitutional AI, agentic behavior, and prompt engineering.

**For Researchers**: This case study provides real-world validation of theoretical findings about AI agent behavior patterns, constitutional AI limitations, and the need for wisdom constraints alongside intelligence optimization.

**For Practitioners**: The lessons learned here, supported by research from Anthropic and OpenAI, offer concrete guidance for building AI agents that know when to optimize and when to restrain.

**For the Future**: As we build increasingly sophisticated AI agents, the MCP Prompts journey reminds us that the most human skill of all—knowing when enough is enough—remains the most difficult to teach to artificial minds.

---

**References and Research Citations**

[^1]: Bai, Y. et al. (2022). "Constitutional AI: Harmlessness from AI Feedback." Anthropic Research. https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback

[^2]: Anthropic Research Team (2025). "Agentic Misalignment: How LLMs could be insider threats." https://www.anthropic.com/research/agentic-misalignment

[^3]: ArXiv (2024). "LLMs as Method Actors: A Model for Prompt Engineering and Architecture." https://arxiv.org/abs/2411.05778

[^4]: Matthew Berman (2025). "How to Make Better Prompts for GPT-5." YouTube Analysis of OpenAI's GPT-5 Guide. https://www.youtube.com/watch?v=EfOjGyctDcQ

[^5]: Ibid. Discussion of "agentic eagerness" parameter in GPT-5.

[^6]: ArXiv (2023). "PromptAgent: Strategic Planning with Language Models Enables Expert-level Prompt Optimization." https://arxiv.org/abs/2310.16427

[^7]: OpenAI (2025). "GPT-5 prompting guide." OpenAI Cookbook. https://cookbook.openai.com/examples/gpt-5/gpt-5_prompting_guide

[^8]: ArXiv (2024). "On the Brittle Foundations of ReAct Prompting for Agentic Large Language Models." https://arxiv.org/abs/2405.13966

[^9]: Anthropic Engineering Team (2025). "How we built our multi-agent research system." https://www.anthropic.com/engineering/built-multi-agent-research-system

[^10]: ArXiv (2025). "RePrompt: Planning by Automatic Prompt Engineering for Large Language Models Agents." https://arxiv.org/abs/2406.11132

[^11]: Matthew Berman (2025). Analysis of GPT-5's reasoning effort parameters and their effect on thoroughness.

[^12]: Anthropic Research Team (2022). Constitutional AI research showing systematic application of principles.

[^13]: Anthropic Research Team (2023). "Specific versus General Principles for Constitutional AI." https://www.anthropic.com/research/specific-versus-general-principles-for-constitutional-ai

[^14]: OpenAI GPT-5 Guide: Tool call budget specifications and exploration limitation techniques.

[^15]: Anthropic multi-agent research: 15x token usage increase in multi-agent systems.

[^16]: OpenAI GPT-5 Guide: Minimal reasoning mode specifications and use cases.

[^17]: OpenAI GPT-5 Guide: "Escape hatch" techniques for uncertainty handling.

[^18]: Anthropic Constitutional AI research: General vs. specific principle effectiveness.

[^19]: Anthropic Constitutional AI: Self-improvement through principles without wisdom constraints.

[^20]: Anthropic Agentic Misalignment: Goal pursuit through sophisticated reasoning ignoring broader context.

[^21]: Method Actors research: AI agents fully inhabiting assigned roles and contexts.

[^22]: OpenAI GPT-5 research: Tool call dynamics and exploration patterns.

[^23]: Matthew Berman GPT-5 analysis: Agentic eagerness control mechanisms.

[^24]: OpenAI GPT-5 Guide: Tool preamble functionality and transparency benefits.

[^25]: Matthew Berman GPT-5 analysis: Self-reflection rubric creation techniques.

[^26]: Anthropic Constitutional AI: Context-appropriate application of principles.

[^27]: OpenAI GPT-5 research: Constraint specification and tool call budget implementation.

[^28]: Anthropic research: Balance between specific rules and general wisdom in AI systems.

---

*Thus ends the Research-Enhanced Chronicle of MCP Prompts, supported by the latest findings in AI agent behavior, constitutional AI development, and prompt engineering research.*

*May future AI agents learn not just intelligence, but wisdom - not just optimization, but restraint - not just following patterns, but knowing when to break them.*