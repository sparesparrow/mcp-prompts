import { v4 as uuidv4 } from 'uuid';
export class SequenceServiceImpl {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    async getSequenceWithPrompts(id) {
        const sequence = await this.storage.getSequence(id);
        if (!sequence) {
            throw new Error(`Sequence with id ${id} not found`);
        }
        const prompts = await Promise.all(sequence.promptIds.map(promptId => this.storage.getPrompt(promptId)));
        const foundPrompts = prompts.filter((p) => p !== null);
        if (foundPrompts.length !== sequence.promptIds.length) {
            console.warn(`Some prompts for sequence ${id} were not found.`);
        }
        return {
            prompts: foundPrompts,
            sequence,
        };
    }
    async createSequence(data) {
        if (!data.name || !data.promptIds) {
            throw new Error('Missing required fields: name and promptIds');
        }
        const now = new Date().toISOString();
        const newSequence = {
            createdAt: now,
            description: data.description,
            id: data.id || uuidv4(),
            metadata: data.metadata,
            name: data.name,
            promptIds: data.promptIds,
            updatedAt: now,
        };
        return this.storage.saveSequence(newSequence);
    }
    async deleteSequence(id) {
        await this.storage.deleteSequence(id);
    }
}
