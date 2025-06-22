/**
 * Server-Sent Events (SSE) implementation for MCP Prompts
 *
 * This module provides functionality for creating SSE servers and clients
 * for the MCP Prompts project. It implements the MCP SSE transport layer
 * following best practices.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'events';
interface MessageQueue {
    messages: Array<{
        id: string;
        event: string;
        data: any;
        timestamp: Date;
        attempts: number;
        priority: 'high' | 'normal' | 'low';
        expiresAt?: Date;
        retryAfter?: Date;
        compressed?: boolean;
        compressionStats?: {
            algorithm: string;
            originalSize: number;
            compressedSize: number;
            compressionRatio: number;
            compressionTime: number;
        };
    }>;
    maxSize: number;
    maxAttempts: number;
    retentionPeriod: number;
    currentSize: number;
    compressionStats: {
        totalCompressed: number;
        totalUncompressed: number;
        avgCompressionRatio: number;
        bytesSaved: number;
        compressionTimeTotal: number;
        compressionTimeAvg: number;
        byAlgorithm: {
            [key: string]: {
                count: number;
                totalSaved: number;
                avgRatio: number;
            };
        };
    };
}
interface ClientState {
    isReconnecting: boolean;
    lastReconnectAttempt: Date | null;
    consecutiveFailures: number;
    lastMessageId: string | null;
    isBackoff: boolean;
    backoffUntil: Date | null;
    lastHeartbeat: Date | null;
    connectionQuality: 'good' | 'fair' | 'poor';
    customHeaders: Record<string, string>;
    features: {
        supportsRetry: boolean;
        supportsLastEventId: boolean;
        supportsBinary: boolean;
        supportsCompression: boolean;
    };
    metrics: {
        messagesReceived: number;
        messagesSent: number;
        bytesReceived: number;
        bytesSent: number;
        lastLatency: number;
        avgLatency: number;
        errorCount: number;
    };
}
interface SseClient {
    id: string;
    req: IncomingMessage;
    res: ServerResponse;
    connected: boolean;
    connectedAt: Date;
    lastActivity: Date;
    history: Array<{
        timestamp: Date;
        event: string;
        data: string;
        id?: string;
        retry?: number;
    }>;
    metadata: Record<string, string>;
    intervals?: {
        heartbeat: NodeJS.Timeout;
        timeout: NodeJS.Timeout;
        cleanup: NodeJS.Timeout;
        messageRetry: NodeJS.Timeout;
        connectionQuality: NodeJS.Timeout;
    };
    reconnectAttempts: number;
    maxReconnectAttempts: number;
    reconnectDelay: number;
    state: ClientState;
    messageQueue: MessageQueue;
}
interface SseManagerOptions {
    heartbeatInterval?: number;
    clientTimeout?: number;
    messageHistory?: number;
    maxReconnectAttempts?: number;
    reconnectDelay?: number;
    cleanupInterval?: number;
    messageQueueSize?: number;
    messageRetryAttempts?: number;
    messageRetryInterval?: number;
    messageRetentionPeriod?: number;
    connectionQualityInterval?: number;
    enableCompression?: boolean;
    maxConcurrentClients?: number;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    compressionMinSize?: number;
    compressionAlgorithm?: 'gzip' | 'deflate' | 'brotli';
    autoSelectCompression?: boolean;
}
/**
 * Manager for SSE clients and message broadcasting
 */
export declare class SseManager extends EventEmitter {
    private clients;
    private _options;
    private _transportImpl;
    private sseTransport;
    private static instance;
    private cleanupInterval;
    private messageRetryInterval;
    private connectionQualityInterval;
    private constructor();
    private _handleShutdown;
    private _retryFailedMessages;
    private _monitorConnectionQuality;
    private _cleanupDisconnectedClients;
    private _calculateConnectionQuality;
    private _handleClientError;
    private _attemptReconnect;
    private _restoreConnection;
    private _replayMissedMessages;
    /**
     * Send a message to a specific client
     * @param clientId The client ID
     * @param message The message to send
     * @returns Success status
     */
    sendToClient(clientId: string, message: any): Promise<boolean>;
    /**
     * Broadcast a message to all connected clients
     * @param message
     */
    broadcast(message: any): void;
    /**
     * Disconnect a client
     * @param clientId The client ID to disconnect
     */
    disconnectClient(clientId: string): Promise<boolean>;
    /**
     * Get active client count
     */
    get clientCount(): number;
    /**
     * Get a list of connected client IDs
     */
    getClientIds(): string[];
    /**
     * Internal method to write to a client
     * @param client
     * @param message
     */
    writeToClient(client: SseClient, message: any): Promise<boolean>;
    /**
     * Add a new SSE client
     * @param req
     * @param res
     */
    addClient(req: IncomingMessage, res: ServerResponse): SseClient;
    handleConnection(req: IncomingMessage, res: ServerResponse): void;
    sendHeartbeat(client: SseClient): Promise<void>;
    updateCompressionStats(compressionStats: {
        algorithm: string;
        originalSize: number;
        compressedSize: number;
        compressionRatio: number;
        compressionTime: number;
    }): void;
    private selectBestCompressionAlgorithm;
    sendMessageToClient(client: SseClient, message: any): Promise<boolean>;
    static getInstance(options?: SseManagerOptions): SseManager;
    shutdown(): void;
    /**
     * Násilně ukončí TCP spojení klienta podle ID (pro testování chyb na klientovi)
     * @param clientId - ID klienta
     */
    destroyClient(clientId: string): void;
}
/**
 *
 * @param options
 */
export declare function getSseManager(options?: SseManagerOptions): SseManager;
/**
 *
 */
export declare function resetSseManager(): void;
export {};
