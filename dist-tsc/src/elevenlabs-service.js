import axios from 'axios';
import { createHash } from 'crypto';
import * as fs from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
const streamPipeline = promisify(pipeline);
export class ElevenLabsService {
    apiKey;
    baseUrl = 'https://api.elevenlabs.io/v1';
    defaultVoiceId;
    model;
    optimizeCost;
    voiceSettings;
    cacheDir;
    maxRetries;
    retryDelay;
    constructor(config) {
        this.apiKey = config.apiKey;
        this.defaultVoiceId = config.voiceId || 'pNInz6obpgDQGcFmaJgB'; // Default to Adam
        this.model = config.model || 'eleven_monolingual_v1';
        this.optimizeCost = config.optimizeCost ?? true;
        this.voiceSettings = {
            similarity_boost: config.similarityBoost ?? 0.75,
            stability: config.stability ?? 0.5,
        };
        this.cacheDir = config.cacheDir || './cache/audio';
        this.maxRetries = config.maxRetries || 3;
        this.retryDelay = config.retryDelay || 1000;
    }
    async makeRequest(method, endpoint, data, headers) {
        let retries = 0;
        while (retries < this.maxRetries) {
            try {
                const response = await axios({
                    data,
                    headers: {
                        'xi-api-key': this.apiKey,
                        ...headers,
                    },
                    method,
                    url: `${this.baseUrl}${endpoint}`,
                });
                return response.data;
            }
            catch (error) {
                if (error.response?.status === 429) {
                    // Rate limit hit - wait and retry
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay * Math.pow(2, retries)));
                    retries++;
                    continue;
                }
                throw this.handleError(error);
            }
        }
        throw new Error(`Failed after ${this.maxRetries} retries`);
    }
    handleError(error) {
        if (error.response) {
            const { status, data } = error.response;
            switch (status) {
                case 401:
                    return new Error('Invalid API key');
                case 429:
                    return new Error('Rate limit exceeded');
                case 400:
                    return new Error(`Bad request: ${data.detail || 'Unknown error'}`);
                default:
                    return new Error(`ElevenLabs API error: ${data.detail || error.message}`);
            }
        }
        return error;
    }
    getCacheKey(text, voiceId) {
        const hash = createHash('md5')
            .update(`${text}${voiceId}${this.model}${JSON.stringify(this.voiceSettings)}`)
            .digest('hex');
        return join(this.cacheDir, `${hash}.mp3`);
    }
    async optimizeText(text) {
        // Remove unnecessary whitespace and normalize text
        text = text.trim().replace(/\s+/g, ' ');
        // Split long text into optimal chunks (max 5000 chars per request)
        if (text.length > 5000) {
            const chunks = text.match(/.{1,5000}(?=\s|$)/g) || [];
            return chunks[0] ?? '';
        }
        return text;
    }
    async textToSpeech(text, options = {}) {
        const voiceId = options.voiceId || this.defaultVoiceId;
        const useCache = options.useCache ?? this.optimizeCost;
        // Optimize text if cost optimization is enabled
        if (this.optimizeCost) {
            text = await this.optimizeText(text);
        }
        // Check cache first if enabled
        if (useCache) {
            const cacheKey = this.getCacheKey(text, voiceId);
            try {
                const readStream = createReadStream(cacheKey);
                return cacheKey;
            }
            catch (error) {
                // Cache miss - continue with API call
            }
        }
        // Prepare request
        const endpoint = `/text-to-speech/${voiceId}`;
        const data = {
            model_id: this.model,
            text,
            voice_settings: this.voiceSettings,
        };
        try {
            const response = await axios({
                data,
                headers: {
                    Accept: 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': this.apiKey,
                },
                method: 'POST',
                responseType: 'stream',
                url: `${this.baseUrl}${endpoint}`,
            });
            // Determine output path
            const outputPath = options.outputPath || this.getCacheKey(text, voiceId);
            // Ensure cache directory exists
            await fs.promises.mkdir(this.cacheDir, { recursive: true });
            // Save the audio file
            await streamPipeline(response.data, createWriteStream(outputPath));
            return outputPath;
        }
        catch (error) {
            throw this.handleError(error);
        }
    }
    async getVoices() {
        return this.makeRequest('GET', '/voices');
    }
    async getVoice(voiceId) {
        return this.makeRequest('GET', `/voices/${voiceId}`);
    }
    async getModels() {
        return this.makeRequest('GET', '/models');
    }
    async getUserSubscription() {
        return this.makeRequest('GET', '/user/subscription');
    }
    async getCharacterCount() {
        const subscription = await this.getUserSubscription();
        return subscription.character_count;
    }
}
