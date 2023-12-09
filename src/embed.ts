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
            if (file.extension === 'md') {
                const embeddingFilePath = `Embeddings/${file.basename}.json`;
                const fileExist = await this.app.vault.adapter.exists(embeddingFilePath);
                if (!fileExist) {
                    new Notice(`Embed new file: ${file.basename}`);
                    const content = await this.app.vault.read(file);
                    const embedding = await this.embedText(content);
                    await this.app.vault.adapter.write(embeddingFilePath, JSON.stringify(embedding));
                } else {
                    console.log(`Embedding already exists for ${file.name}, skipping...`);
                }
            }
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
                relevantFiles.push(`[[${file.name.replace('.json', '')}]]`);
            }
        }

        const outputString = relevantFiles.join('\n\n');
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
