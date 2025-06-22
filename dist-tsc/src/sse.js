/**
 * Server-Sent Events (SSE) implementation for MCP Prompts
 *
 * This module provides functionality for creating SSE servers and clients
 * for the MCP Prompts project. It implements the MCP SSE transport layer
 * following best practices.
 */
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { brotliCompress, deflate, gzip } from 'node:zlib';
import { EventEmitter } from 'events';
const gzipAsync = promisify(gzip);
const deflateAsync = promisify(deflate);
const brotliCompressAsync = promisify(brotliCompress);
/**
 * Manager for SSE clients and message broadcasting
 */
export class SseManager extends EventEmitter {
    clients = new Map();
    _options;
    _transportImpl = null;
    sseTransport = null;
    static instance = null;
    cleanupInterval = null;
    messageRetryInterval = null;
    connectionQualityInterval = null;
    constructor(options = {}) {
        super();
        this._options = {
            autoSelectCompression: options.autoSelectCompression || false,
            cleanupInterval: options.cleanupInterval || 300000,
            clientTimeout: options.clientTimeout || 60000,
            compressionAlgorithm: options.compressionAlgorithm || 'gzip',
            compressionMinSize: options.compressionMinSize || 1024,
            // 1 hour
            connectionQualityInterval: options.connectionQualityInterval || 60000,
            enableCompression: options.enableCompression || false,
            heartbeatInterval: options.heartbeatInterval || 30000,
            logLevel: options.logLevel || 'info',
            maxConcurrentClients: options.maxConcurrentClients || 1000,
            maxReconnectAttempts: options.maxReconnectAttempts || 5,
            messageHistory: options.messageHistory || 50,
            // 5 minutes
            messageQueueSize: options.messageQueueSize || 1000,
            messageRetentionPeriod: options.messageRetentionPeriod || 3600000,
            messageRetryAttempts: options.messageRetryAttempts || 3,
            messageRetryInterval: options.messageRetryInterval || 10000,
            reconnectDelay: options.reconnectDelay || 5000,
            ...options,
        };
        // Start the cleanup interval
        this.cleanupInterval = setInterval(() => {
            void this._cleanupDisconnectedClients();
        }, this._options.cleanupInterval);
        // Start message retry interval
        this.messageRetryInterval = setInterval(() => {
            void this._retryFailedMessages();
        }, this._options.messageRetryInterval);
        // Start connection quality monitoring
        this.connectionQualityInterval = setInterval(() => {
            void this._monitorConnectionQuality();
        }, this._options.connectionQualityInterval);
        // Handle process termination
        process.on('SIGTERM', () => {
            void this._handleShutdown();
        });
        process.on('SIGINT', () => {
            void this._handleShutdown();
        });
    }
    async _handleShutdown() {
        console.log('Shutting down SSE manager...');
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        if (this.messageRetryInterval) {
            clearInterval(this.messageRetryInterval);
        }
        if (this.connectionQualityInterval) {
            clearInterval(this.connectionQualityInterval);
        }
        for (const client of this.clients.values()) {
            await this.disconnectClient(client.id);
        }
        this.clients.clear();
        console.log('SSE manager shutdown complete.');
    }
    async _retryFailedMessages() {
        for (const client of this.clients.values()) {
            if (!client.connected || client.state.isBackoff)
                continue;
            const now = new Date();
            const messages = client.messageQueue.messages.filter(msg => msg.attempts < client.messageQueue.maxAttempts &&
                (!client.state.lastMessageId || msg.id > client.state.lastMessageId));
            for (const message of messages) {
                try {
                    const success = await this.writeToClient(client, {
                        data: message.data,
                        event: message.event,
                        id: message.id,
                    });
                    if (success) {
                        client.state.lastMessageId = message.id;
                        client.messageQueue.messages = client.messageQueue.messages.filter(m => m.id !== message.id);
                    }
                    else {
                        message.attempts++;
                        if (message.attempts >= client.messageQueue.maxAttempts) {
                            console.warn(`Message ${message.id} to client ${client.id} failed after ${message.attempts} attempts`);
                        }
                    }
                }
                catch (error) {
                    console.error(`Error retrying message ${message.id} to client ${client.id}:`, error);
                    message.attempts++;
                }
            }
        }
    }
    _monitorConnectionQuality() {
        const now = new Date();
        for (const client of this.clients.values()) {
            if (!client.connected)
                continue;
            // Check heartbeat health
            const timeSinceLastHeartbeat = client.state.lastHeartbeat
                ? now.getTime() - client.state.lastHeartbeat.getTime()
                : Infinity;
            // Update connection quality
            const oldQuality = client.state.connectionQuality;
            client.state.connectionQuality = this._calculateConnectionQuality(client, timeSinceLastHeartbeat);
            // Emit quality change event
            if (oldQuality !== client.state.connectionQuality) {
                this.emit('connectionQualityChange', {
                    clientId: client.id,
                    metrics: client.state.metrics,
                    newQuality: client.state.connectionQuality,
                    oldQuality,
                });
            }
            // Handle poor connection quality
            if (client.state.connectionQuality === 'poor') {
                console.warn(`Poor connection quality for client ${client.id}:`, {
                    metrics: client.state.metrics,
                    timeSinceLastHeartbeat,
                });
                // Try to recover the connection
                this._handleClientError(client, new Error('Poor connection quality'));
            }
        }
    }
    async _cleanupDisconnectedClients() {
        const now = new Date();
        for (const [clientId, client] of this.clients.entries()) {
            // Check if client is active
            const timeSinceLastActivity = now.getTime() - client.lastActivity.getTime();
            const isInactive = timeSinceLastActivity > this._options.clientTimeout;
            // Check if client is in a failed state
            const isFailedState = client.state.consecutiveFailures >= client.maxReconnectAttempts ||
                (client.state.connectionQuality === 'poor' && !client.state.isReconnecting);
            if (!client.connected || isInactive || isFailedState) {
                if (client.state.isReconnecting && client.reconnectAttempts < client.maxReconnectAttempts) {
                    // Let reconnection logic handle it
                    continue;
                }
                console.info(`Cleaning up client ${clientId}:`, {
                    connected: client.connected,
                    isFailedState,
                    isInactive,
                    metrics: client.state.metrics,
                    timeSinceLastActivity,
                });
                // Perform cleanup
                await this.disconnectClient(client.id);
                // Emit cleanup event
                this.emit('clientCleanup', {
                    clientId,
                    metrics: client.state.metrics,
                    reason: isInactive ? 'inactive' : isFailedState ? 'failed' : 'disconnected',
                });
            }
        }
        // Log overall status
        if (this._options.logLevel === 'debug') {
            console.debug('SSE manager status:', {
                activeClients: Array.from(this.clients.values()).filter(c => c.connected).length,
                reconnectingClients: Array.from(this.clients.values()).filter(c => c.state.isReconnecting)
                    .length,
                totalClients: this.clients.size,
            });
        }
    }
    _calculateConnectionQuality(client, timeSinceLastHeartbeat) {
        // Calculate quality based on multiple factors
        const factors = {
            errorRate: client.state.metrics.errorCount === 0 ? 1 : client.state.metrics.errorCount < 3 ? 0.5 : 0,
            heartbeatDelay: timeSinceLastHeartbeat > 45000 ? 0 : timeSinceLastHeartbeat > 30000 ? 0.5 : 1,
            latency: client.state.metrics.avgLatency < 100 ? 1 : client.state.metrics.avgLatency < 500 ? 0.5 : 0,
            messageSuccess: client.state.metrics.messagesSent === 0
                ? 1
                : client.state.metrics.messagesSent /
                    (client.state.metrics.messagesSent + client.state.metrics.errorCount),
        };
        // Calculate weighted average
        const score = factors.heartbeatDelay * 0.4 +
            factors.errorRate * 0.3 +
            factors.latency * 0.2 +
            factors.messageSuccess * 0.1;
        // Map score to quality level
        if (score >= 0.8)
            return 'good';
        if (score >= 0.5)
            return 'fair';
        return 'poor';
    }
    async _handleClientError(client, error) {
        client.state.metrics.errorCount++;
        client.state.consecutiveFailures++;
        // Log the error with context
        console.error(`Client ${client.id} error:`, {
            connectionQuality: client.state.connectionQuality,
            consecutiveFailures: client.state.consecutiveFailures,
            error: error.message,
            lastMessageId: client.state.lastMessageId,
            metrics: client.state.metrics,
            stack: error.stack,
        });
        // Implement exponential backoff
        if (client.state.consecutiveFailures > 1) {
            const backoffTime = Math.min(1000 * Math.pow(2, client.state.consecutiveFailures - 1), 30000);
            client.state.isBackoff = true;
            client.state.backoffUntil = new Date(Date.now() + backoffTime);
            console.warn(`Client ${client.id} entering backoff for ${backoffTime}ms`);
            // Schedule reconnection attempt after backoff
            setTimeout(async () => {
                client.state.isBackoff = false;
                client.state.backoffUntil = null;
                const success = await this._attemptReconnect(client);
                if (success) {
                    client.state.consecutiveFailures = 0;
                    console.info(`Client ${client.id} successfully reconnected after backoff`);
                }
            }, backoffTime);
        }
        else {
            // First failure, try immediate reconnection
            const success = await this._attemptReconnect(client);
            if (success) {
                client.state.consecutiveFailures = 0;
                console.info(`Client ${client.id} successfully reconnected`);
            }
        }
        // If max failures reached, disconnect the client
        if (client.state.consecutiveFailures >= client.maxReconnectAttempts) {
            console.error(`Client ${client.id} exceeded max reconnection attempts, disconnecting`);
            await this.disconnectClient(client.id);
            return;
        }
        // Emit error event for monitoring
        this.emit('clientError', {
            clientId: client.id,
            connectionQuality: client.state.connectionQuality,
            consecutiveFailures: client.state.consecutiveFailures,
            error: error.message,
            metrics: client.state.metrics,
        });
    }
    async _attemptReconnect(client) {
        if (!client || client.state.isReconnecting) {
            return false;
        }
        client.state.isReconnecting = true;
        client.state.lastReconnectAttempt = new Date();
        client.reconnectAttempts++;
        console.info(`Attempting to reconnect client ${client.id} (attempt ${client.reconnectAttempts}/${client.maxReconnectAttempts})`);
        try {
            // Try to restore the connection
            const success = await this._restoreConnection(client);
            if (success) {
                // Reset reconnection state
                client.state.isReconnecting = false;
                client.reconnectAttempts = 0;
                client.state.lastReconnectAttempt = null;
                // Replay any missed messages
                await this._replayMissedMessages(client);
                // Emit reconnected event
                this.emit('clientReconnected', {
                    clientId: client.id,
                    metrics: client.state.metrics,
                });
                return true;
            }
        }
        catch (error) {
            console.error(`Error during reconnection for client ${client.id}:`, error);
        }
        client.state.isReconnecting = false;
        return false;
    }
    async _restoreConnection(client) {
        if (!client.req || !client.res) {
            return false;
        }
        try {
            // Set up SSE headers
            client.res.writeHead(200, {
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
                'Content-Type': 'text/event-stream',
                ...client.state.customHeaders,
            });
            // Send initial reconnection message
            const success = await this.writeToClient(client, {
                data: {
                    lastMessageId: client.state.lastMessageId,
                    timestamp: new Date().toISOString(),
                },
                event: 'reconnect',
            });
            if (success) {
                // Reset client state
                client.connected = true;
                client.lastActivity = new Date();
                client.state.lastHeartbeat = new Date();
                // Start heartbeat
                await this.sendHeartbeat(client);
                return true;
            }
        }
        catch (error) {
            console.error(`Error restoring connection for client ${client.id}:`, error);
        }
        return false;
    }
    async _replayMissedMessages(client) {
        if (!client.state.lastMessageId || !client.connected) {
            return;
        }
        const missedMessages = client.messageQueue.messages.filter(msg => msg.id > client.state.lastMessageId && (!msg.expiresAt || msg.expiresAt > new Date()));
        console.log(`Replaying ${missedMessages.length} missed messages for client ${client.id}`);
        for (const message of missedMessages) {
            try {
                const success = await this.writeToClient(client, {
                    data: message.data,
                    event: message.event,
                    id: message.id,
                });
                if (success) {
                    client.state.lastMessageId = message.id;
                }
                else {
                    break; // Stop if we can't send a message
                }
            }
            catch (error) {
                console.error(`Error replaying message ${message.id} to client ${client.id}:`, error);
                break;
            }
        }
    }
    /**
     * Send a message to a specific client
     * @param clientId The client ID
     * @param message The message to send
     * @returns Success status
     */
    async sendToClient(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client) {
            return false;
        }
        return await this.writeToClient(client, message);
    }
    /**
     * Broadcast a message to all connected clients
     * @param message
     */
    broadcast(message) {
        const data = `data: ${JSON.stringify(message)}\n\n`;
        for (const client of this.clients.values()) {
            if (client.connected) {
                try {
                    client.res.write(data);
                    if (typeof client.res.flush === 'function') {
                        client.res.flush();
                    }
                    console.log(`[SSE] broadcast: Sent to client ${client.id}:`, data);
                }
                catch (err) {
                    console.warn(`[SSE] broadcast: Failed to send to client ${client.id}:`, err);
                }
            }
        }
    }
    /**
     * Disconnect a client
     * @param clientId The client ID to disconnect
     */
    async disconnectClient(clientId) {
        const client = this.clients.get(clientId);
        if (!client)
            return false;
        // Actual disconnect logic (add more as needed)
        client.connected = false;
        this.clients.delete(clientId);
        console.log(`[SSE] removeClient: Removed client ${clientId}`);
        console.log(`[SSE] removeClient: Current client IDs:`, Array.from(this.clients.keys()));
        return true;
    }
    /**
     * Get active client count
     */
    get clientCount() {
        return this.clients.size;
    }
    /**
     * Get a list of connected client IDs
     */
    getClientIds() {
        return Array.from(this.clients.keys());
    }
    /**
     * Internal method to write to a client
     * @param client
     * @param message
     */
    async writeToClient(client, message) {
        if (!client.connected || client.state.isBackoff) {
            return false;
        }
        try {
            let data = typeof message.data === 'object' ? JSON.stringify(message.data) : String(message.data);
            let compressed = false;
            let compressionStats = null;
            // Compress data if enabled and client supports it
            if (this._options.enableCompression &&
                client.state.features &&
                client.state.features.supportsCompression &&
                this._options.compressionMinSize &&
                (data?.length ?? 0) > this._options.compressionMinSize) {
                const startTime = Date.now();
                try {
                    let compressedData;
                    let algorithm = this._options.compressionAlgorithm;
                    // Auto-select best compression algorithm based on data size and type
                    if (this._options.autoSelectCompression) {
                        algorithm = this.selectBestCompressionAlgorithm(data);
                    }
                    switch (algorithm) {
                        case 'gzip':
                            compressedData = await gzipAsync(Buffer.from(data));
                            break;
                        case 'deflate':
                            compressedData = await deflateAsync(Buffer.from(data));
                            break;
                        case 'brotli':
                            compressedData = await brotliCompressAsync(Buffer.from(data));
                            break;
                        default:
                            throw new Error(`Unsupported compression algorithm: ${algorithm}`);
                    }
                    const compressionTime = Date.now() - startTime;
                    const originalSize = data.length;
                    const compressedSize = compressedData.length;
                    const compressionRatio = originalSize / compressedSize;
                    // Only use compression if it actually saves space
                    if (compressedSize < originalSize) {
                        data = compressedData.toString('base64');
                        compressed = true;
                        compressionStats = {
                            algorithm,
                            compressedSize,
                            compressionRatio,
                            compressionTime,
                            originalSize,
                        };
                        // Update compression stats
                        this.updateCompressionStats(compressionStats);
                    }
                }
                catch (error) {
                    console.warn('Compression error:', error);
                }
            }
            // Send message to client
            const success = await this.sendMessageToClient(client, {
                compressed: compressed,
                compressionStats: compressionStats,
                data: data,
                event: message.event,
                id: message.id,
            });
            return success;
        }
        catch (error) {
            console.error(`Error writing message to client ${client.id}:`, error);
            return false;
        }
    }
    /**
     * Add a new SSE client
     * @param req
     * @param res
     */
    addClient(req, res) {
        const clientId = randomUUID();
        const now = new Date();
        const client = {
            connected: true,
            connectedAt: now,
            history: [],
            id: clientId,
            lastActivity: now,
            maxReconnectAttempts: this._options.maxReconnectAttempts || 5,
            messageQueue: {
                compressionStats: {
                    avgCompressionRatio: 1,
                    byAlgorithm: {},
                    bytesSaved: 0,
                    compressionTimeAvg: 0,
                    compressionTimeTotal: 0,
                    totalCompressed: 0,
                    totalUncompressed: 0,
                },
                currentSize: 0,
                maxAttempts: this._options.messageRetryAttempts || 3,
                maxSize: this._options.messageQueueSize || 1000,
                messages: [],
                retentionPeriod: this._options.messageRetentionPeriod || 3600000,
            },
            metadata: {},
            reconnectAttempts: 0,
            reconnectDelay: this._options.reconnectDelay || 5000,
            req,
            res,
            state: {
                backoffUntil: null,
                connectionQuality: 'good',
                consecutiveFailures: 0,
                customHeaders: {},
                features: {
                    supportsBinary: false,
                    supportsCompression: !!this._options.enableCompression,
                    supportsLastEventId: true,
                    supportsRetry: true,
                },
                isBackoff: false,
                isReconnecting: false,
                lastHeartbeat: now,
                lastMessageId: null,
                lastReconnectAttempt: null,
                metrics: {
                    avgLatency: 0,
                    bytesReceived: 0,
                    bytesSent: 0,
                    errorCount: 0,
                    lastLatency: 0,
                    messagesReceived: 0,
                    messagesSent: 0,
                },
            },
        };
        // Set required SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        // Initial comment and connected message
        res.write(':\n\n');
        res.write('data: "connected"\n\n');
        if (typeof res.flush === 'function') {
            res.flush();
        }
        console.log(`[SSE] addClient: Added client ${clientId}`);
        this.clients.set(clientId, client);
        console.log(`[SSE] addClient: Current client IDs:`, Array.from(this.clients.keys()));
        // Cleanup on close/error
        const cleanup = () => {
            if (this.clients.has(clientId)) {
                this.clients.delete(clientId);
                if (this._options.logLevel === 'debug' || process.env.NODE_ENV === 'test') {
                    console.log(`[SSE] Client disconnected: ${clientId}`);
                }
            }
        };
        req.on('close', cleanup);
        req.on('aborted', cleanup);
        res.on('close', cleanup);
        return client;
    }
    handleConnection(req, res) {
        console.log('[SSE] handleConnection: New connection');
        const client = this.addClient(req, res);
        if (this._options.logLevel === 'debug' || process.env.NODE_ENV === 'test') {
            console.log(`[SSE] handleConnection: client ${client.id} registered. Total clients: ${this.clients.size}`);
        }
        console.log('[SSE] handleConnection: Connection setup complete');
    }
    async sendHeartbeat(client) {
        // Implementation here
    }
    updateCompressionStats(compressionStats) {
        // Implementation here
    }
    selectBestCompressionAlgorithm(data) {
        // Implementation here
        return 'gzip';
    }
    async sendMessageToClient(client, message) {
        // Implementation here
        return false;
    }
    static getInstance(options) {
        if (!SseManager.instance) {
            SseManager.instance = new SseManager(options);
        }
        return SseManager.instance;
    }
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        if (this.messageRetryInterval) {
            clearInterval(this.messageRetryInterval);
            this.messageRetryInterval = null;
        }
        if (this.connectionQualityInterval) {
            clearInterval(this.connectionQualityInterval);
            this.connectionQualityInterval = null;
        }
        // Odpojit všechny klienty
        for (const client of this.clients.values()) {
            this.disconnectClient(client.id);
        }
        this.clients.clear();
    }
    /**
     * Násilně ukončí TCP spojení klienta podle ID (pro testování chyb na klientovi)
     * @param clientId - ID klienta
     */
    destroyClient(clientId) {
        const client = this.clients.get(clientId);
        if (client?.res?.socket) {
            client.res.socket.destroy();
        }
        this.disconnectClient(clientId);
    }
}
let sseManagerInstance = null;
/**
 *
 * @param options
 */
export function getSseManager(options) {
    if (!sseManagerInstance) {
        sseManagerInstance = SseManager.getInstance(options);
    }
    return sseManagerInstance;
}
/**
 *
 */
export function resetSseManager() {
    if (sseManagerInstance) {
        sseManagerInstance.shutdown();
    }
    sseManagerInstance = null;
}
