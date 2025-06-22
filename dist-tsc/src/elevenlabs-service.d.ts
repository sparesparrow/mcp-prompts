interface ElevenLabsConfig {
    apiKey: string;
    voiceId?: string;
    model?: string;
    optimizeCost?: boolean;
    stability?: number;
    similarityBoost?: number;
    cacheDir?: string;
    maxRetries?: number;
    retryDelay?: number;
}
export declare class ElevenLabsService {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly defaultVoiceId;
    private readonly model;
    private readonly optimizeCost;
    private readonly voiceSettings;
    private readonly cacheDir;
    private readonly maxRetries;
    private readonly retryDelay;
    constructor(config: ElevenLabsConfig);
    private makeRequest;
    private handleError;
    private getCacheKey;
    private optimizeText;
    textToSpeech(text: string, options?: {
        voiceId?: string;
        outputPath?: string;
        useCache?: boolean;
    }): Promise<string>;
    getVoices(): Promise<any[]>;
    getVoice(voiceId: string): Promise<any>;
    getModels(): Promise<any[]>;
    getUserSubscription(): Promise<any>;
    getCharacterCount(): Promise<number>;
}
export {};
