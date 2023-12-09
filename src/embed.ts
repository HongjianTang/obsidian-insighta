import * as fs from 'fs';
import * as path from 'path';
import { ChatGPT } from 'src/api';
import { App, Notice } from "obsidian";
import { ViewManager } from "src/view-manager";

export class Embed{
    app: App;
    viewManager: ViewManager;

    constructor(app: App, viewManager: ViewManager) {
        this.app = app;
        this.viewManager = viewManager;
    }

    async embedText(text: string): Promise<number[]> {
        try {
            const response = await ChatGPT.createEmbedding(text);
            // new Notice(JSON.stringify(response));
            return response;
        } catch (error) {
            console.error("Error in embedding text:", error);
            return [];
        }
    }

    async saveEmbeddings(directoryPath: string) {
        const files = app.vault.getFiles().filter(f => f.path.includes(directoryPath))
        new Notice(`Total files count: ${files.length}.`)
        for (const file of files) {
            const fileContent = await app.vault.read(file);
            // new Notice(fileContent);
            const embedding = await this.embedText(fileContent);
            const embeddingPath = `Embeddings/${file.basename}.json`;
            this.app.vault.create(embeddingPath, JSON.stringify(embedding));
        }
    }

    async searchRelatedNotes(topic: string, embeddingsPath: string, outputFilePath: string) {
        new Notice(topic);
        const queryEmbedding = await this.embedText(topic);
        const embeddingFiles = app.vault.getFiles().filter(f => f.path.includes(embeddingsPath))
        const relevantFiles = [];

        for (const file of embeddingFiles) {
            const fileContent = await app.vault.read(file);
            const embeddingJson = JSON.parse(fileContent);
            const embeddingArray: number[] = embeddingJson;
            const similarity = this.dotProduct(embeddingArray, queryEmbedding);
            new Notice(`[[${file.name.replace('.json', 'md')}]], ${similarity}`);
            if (similarity > 0.75) {
                relevantFiles.push(`[[${file.name.replace('.json', 'md')}]]`);
            }
        }

        const outputString = relevantFiles.join('\n');
        new Notice(outputString);
        this.viewManager.insertContentAtTop(outputString);
    }

    dotProduct(vec1: number[], vec2: number[]): number {
        let dot = 0;
        for (let i = 0; i < vec1.length; i++) {
            dot += vec1[i] * vec2[i];
        }
        return dot;
    }

    
}
