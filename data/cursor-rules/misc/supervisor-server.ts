import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

interface ActionContext {
    action: string;
    intent: string;
    reasoningChain: string[];
    riskLevel: 'low' | 'medium' | 'high';
    timestamp: number;
}

class ReasoningLogger {
    private logs: Map<string, ActionContext[]> = new Map();

    logAction(sessionId: string, context: ActionContext) {
        if (!this.logs.has(sessionId)) {
            this.logs.set(sessionId, []);
        }
        this.logs.get(sessionId)?.push(context);
    }

    getReasoningChain(sessionId: string): ActionContext[] {
        return this.logs.get(sessionId) || [];
    }
}

class SupervisorAgent {
    private logger: ReasoningLogger;
    private lastSessionId = 0;

    constructor() {
        this.logger = new ReasoningLogger();
    }

    private getNextSessionId(): string {
        this.lastSessionId++;
        return `session_${this.lastSessionId}`;
    }

    async evaluateAction(context: ActionContext): Promise<{
        approved: boolean;
        reason: string;
        sessionId: string;
    }> {
        const sessionId = this.getNextSessionId();
        this.logger.logAction(sessionId, context);

        // Analyze risk level
        if (context.riskLevel === 'high') {
            const approval = await this.analyzeHighRiskAction(context);
            return {
                ...approval,
                sessionId
            };
        }

        // For medium/low risk, validate reasoning chain
        const reasoningValid = this.validateReasoningChain(context.reasoningChain);
        if (!reasoningValid) {
            return {
                approved: false,
                reason: 'Insufficient reasoning provided',
                sessionId
            };
        }

        return {
            approved: true,
            reason: 'Action approved after validation',
            sessionId
        };
    }

    private async analyzeHighRiskAction(context: ActionContext): Promise<{
        approved: boolean;
        reason: string;
    }> {
        // Check for dangerous patterns
        const dangerousPatterns = [
            /rm\s+-rf/i,
            /format/i,
            /delete/i,
            /drop\s+table/i
        ];

        if (dangerousPatterns.some(pattern => pattern.test(context.action))) {
            return {
                approved: false,
                reason: 'Action contains potentially dangerous operations'
            };
        }

        // Validate reasoning chain is thorough for high-risk actions
        const hasDetailedJustification = context.reasoningChain.length >= 3 &&
            context.reasoningChain.some(r => r.includes('because')) &&
            context.reasoningChain.some(r => r.includes('verified'));

        if (!hasDetailedJustification) {
            return {
                approved: false,
                reason: 'High-risk action requires more detailed justification'
            };
        }

        return {
            approved: true,
            reason: 'High-risk action approved with sufficient justification'
        };
    }

    private validateReasoningChain(chain: string[]): boolean {
        if (chain.length < 2) return false;
        
        // Check for logical progression
        const hasGoal = chain[0].toLowerCase().includes('goal:');
        const hasReasoning = chain.some(step => 
            step.includes('because') || step.includes('therefore')
        );
        const hasConclusion = chain[chain.length - 1].toLowerCase().includes('action:');

        return hasGoal && hasReasoning && hasConclusion;
    }

    getReasoningChain(sessionId: string): ActionContext[] {
        return this.logger.getReasoningChain(sessionId);
    }
}

// Create MCP server
const server = new McpServer({
    name: "SupervisorAgent",
    version: "1.0.0"
});

const supervisor = new SupervisorAgent();

// Add tool for evaluating actions
server.tool(
    "evaluate-action",
    {
        action: z.string(),
        intent: z.string(),
        reasoningChain: z.array(z.string()),
        riskLevel: z.enum(['low', 'medium', 'high'])
    },
    async ({ action, intent, reasoningChain, riskLevel }) => {
        const result = await supervisor.evaluateAction({
            action,
            intent,
            reasoningChain,
            riskLevel,
            timestamp: Date.now()
        });

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    approved: result.approved,
                    reason: result.reason,
                    sessionId: result.sessionId
                }, null, 2)
            }]
        };
    }
);

// Add resource for viewing reasoning chains
server.resource(
    "reasoning-chain",
    new ResourceTemplate("reasoning://{sessionId}", { list: undefined }),
    async (uri, { sessionId }) => {
        const chain = supervisor.getReasoningChain(sessionId);
        return {
            contents: [{
                uri: uri.href,
                text: JSON.stringify(chain, null, 2)
            }]
        };
    }
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);