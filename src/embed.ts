import {ChatGPT} from 'src/api';
import {App} from "obsidian";
import {ViewManager} from "src/view-manager";
import {InsightASettings} from "src/settings";

export class Embed {
	app: App;
	viewManager: ViewManager;
	setting: InsightASettings;

	constructor(app: App, viewManager: ViewManager, setting: InsightASettings) {
		this.app = app;
		this.viewManager = viewManager;
		this.setting = setting;
	}

	async embedText(text: string): Promise<number[]> {
		try {
			return await ChatGPT.createEmbedding(text);
		} catch (error) {
			console.error("Error in embedding text:", error);
			return [];
		}
	}

	async saveEmbeddings() {
		const files = app.vault.getFiles().filter(f => f.path.includes(this.setting.commandOption.source_notes_location))
		console.log(`Total files count: ${files.length}.`)

		for (const file of files) {
			if (file.extension === 'md') {
				const embeddingFilePath = `Embeddings/${file.basename}.json`;
				const fileExist = await this.app.vault.adapter.exists(embeddingFilePath);
				if (!fileExist) {
					console.log(`Embed new file: ${file.basename}`);
					const title = file.basename.replace('.md', '');
					const content = await this.app.vault.read(file);
					const embedding_text = title + content;
					const embedding = await this.embedText(embedding_text);
					await this.app.vault.adapter.write(embeddingFilePath, JSON.stringify(embedding));
				} else {
					// console.log(`Embedding already exists for ${file.name}, skipping...`);
				}
			}
		}
	}

	async searchRelatedNotes(topic: string, outputFilePath: string) {
		const queryEmbedding = await this.embedText(topic);
		const embeddingFiles = app.vault.getFiles().filter(f => f.path.includes(this.setting.commandOption.embedding_location))
		const relevantFiles = [];

		for (const file of embeddingFiles) {
			const fileContent = await app.vault.read(file);
			const embeddingJson = JSON.parse(fileContent);
			const embeddingArray: number[] = embeddingJson;
			const similarity = this.dotProduct(embeddingArray, queryEmbedding);
			console.log(`${file.name.replace('.json', 'md')}, similarity = ${similarity}`);
			if (similarity > this.setting.commandOption.similar_threshold) {
				relevantFiles.push(`[[${file.name.replace('.json', '')}]]`);
			}
		}

		const outputString = relevantFiles.join('\n\n');
		// this.viewManager.insertContentAtTop(outputString);

		console.log(`Topic: ${topic}, Notes: ${outputString}`);
		const user_prompt = `Topic: ${topic}, Notes: ${outputString}`;
		const system_role = "Role: You're a skilled analyst in thematic organization and categorization. Instructions: Classify the provided notes into thematic groups and present them in a structured format. Steps:  Examine each notes. Categorize notes into distinct thematic groups. Each group should be represented by a Level 2 header that succinctly describes the overarching theme.        List the names of the notes under each theme, ensuring each note name starts with [[ and ends with ]]."

		// Call API
		let returnString = await ChatGPT.callAPI(system_role, user_prompt, this.setting.commandOption.llm_model);
		await this.viewManager.insertContentAtTop(returnString);
	}

	dotProduct(vec1: number[], vec2: number[]): number {
		let dot = 0;
		for (let i = 0; i < vec1.length; i++) {
			dot += vec1[i] * vec2[i];
		}
		return dot;
	}


}
