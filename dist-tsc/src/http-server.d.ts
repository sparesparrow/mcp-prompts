import http from 'http';
import type { PromptService } from './prompt-service.js';
import type { SequenceService } from './sequence-service.js';
import type { WorkflowService } from './workflow-service.js';
import { StorageAdapter } from './interfaces.js';
export interface HttpServerConfig {
    port: number;
    host: string;
    corsOrigin?: string;
    enableSSE?: boolean;
    ssePath?: string;
    rateLimit?: {
        windowMs: number;
        max: number;
    };
}
export interface ServerServices {
    promptService: PromptService;
    sequenceService: SequenceService;
    workflowService: WorkflowService;
    storageAdapters: StorageAdapter[];
    elevenLabsService?: any;
}
/**
 *
 * @param server
 * @param config
 * @param services
 */
export declare function startHttpServer(server: any | null | undefined, config: HttpServerConfig, services: ServerServices): Promise<http.Server>;
