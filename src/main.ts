import { Plugin, Notice } from "obsidian";
import { InsightASettingTab, InsightASettings, DEFAULT_SETTINGS } from "src/settings";
import { DEFAULT_PROMPT_TEMPLATE } from 'src/template';
import { ViewManager } from "src/view-manager";
import { ChatGPT } from 'src/api';
import { Embed } from 'src/embed';

enum InputType {
	SelectedArea,
	Content
}

export default class InsightAPlugin extends Plugin {
	settings: InsightASettings;
	embed: Embed;
	viewManager = new ViewManager(this.app);

	async onload() {
		await this.loadSettings();
		process.env.OPENAI_API_KEY = this.settings.commandOption.openai_key;
		this.embed = new Embed(this.app, this.viewManager, this.settings);

		this.registerCommands();
		this.addSettingTab(new InsightASettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	saveSettingsInstant() {
		this.saveData(this.settings);
	}

	onunload() {}

	private registerCommands() {
		this.addCommand({
			id: 'create-atomic-notes-selected',
			name: 'Create atomic notes from Selected Area',
			callback: () => this.runExtractNotes(InputType.SelectedArea)
		});
		this.addCommand({
			id: 'create-atomic-notes-content',
			name: 'Create atomic notes from Note Content',
			callback: () => this.runExtractNotes(InputType.Content)
		});
		this.addCommand({
			id: 'update-moc',
			name: 'Update moc',
			callback: () => this.updateMoc()
		});
	}

	private async runExtractNotes(inputType: InputType) {
		const loadingNotice = this.createLoadingNotice(`${this.manifest.name}: Processing..`);
		try {
			await this.extractNotes(inputType);
		} catch (err) {
			console.error(err);
		} finally {
			loadingNotice.hide();
		}
	}

	private async extractNotes(inputType: InputType) {
		if (!this.isApiKeyValid()) {
			return;
		}

		const input = await this.getInput(inputType);
		if (!input) {
			new Notice(`⛔ ${this.manifest.name}: no input data`);
			return;
		}

		const filename = await this.viewManager.getTitle() ?? "Untitled";
		const userPrompt = this.formatUserPrompt(input);
		const systemPrompt = this.formatSystemPrompt();

		try {
			const noteArray = await this.getNotesFromApi(systemPrompt, userPrompt);
			await this.createNotes(noteArray, filename);
			new Notice(`✅ ${this.manifest.name}: finish`);
		} catch (error) {
			console.error(error);
			new Notice(`⛔ ${this.manifest.name}: Failed to extract notes`);
		}
	}

	private isApiKeyValid(): boolean {
		if (!process.env.OPENAI_API_KEY) {
			new Notice(`⛔ ${this.manifest.name}: You should input your API Key`);
			return false;
		}
		return true;
	}

	private async getInput(inputType: InputType): Promise<string | null> {
		if (inputType === InputType.SelectedArea) {
			return await this.viewManager.getSelection();
		} else if (inputType === InputType.Content) {
			return await this.viewManager.getContent();
		}
		return null;
	}

	private formatUserPrompt(input: string): string {
		let userPrompt = DEFAULT_PROMPT_TEMPLATE;
		return userPrompt.replace('{{input}}', input);
	}

	private formatSystemPrompt(): string {
		const { system_role, notes_quantity, tags_quantity, language_option, specific_language, properties } = this.settings.commandOption;
		return system_role
			.replace(/{{number_of_notes}}/g, notes_quantity.toString())
			.replace(/{{number_of_tags}}/g, tags_quantity.toString())
			.replace(/{{language}}/g, language_option === 'specific' ? specific_language : language_option)
			.replace(/{{properties}}/g, properties);
	}

	private async getNotesFromApi(systemPrompt: string, userPrompt: string): Promise<any[]> {
		let noteJsonString = await ChatGPT.callAPI(systemPrompt, userPrompt, this.settings.commandOption.llm_model);
		noteJsonString = noteJsonString.replace(/```json/g, "").replace(/```/g, "");
		noteJsonString = this.convertToJsonArray(noteJsonString);
		console.log(`noteJsonString: ${noteJsonString}`);
		let noteArray;
		try {
			noteArray = JSON.parse(noteJsonString);
		} catch (error) {
			throw new Error("Invalid JSON format");
		}
		if (!Array.isArray(noteArray)) {
			new Notice(`⛔ return json is not array`);
			return [noteArray];
		}
		return noteArray;
	}

	private async createNotes(noteArray: any[], filename: string) {
		for (const note of noteArray) {
			const processedTags = this.processTags(note.tags);
			const noteContent = this.generateNoteContent(note, filename, processedTags);
			const notePath = `${this.settings.commandOption.generated_notes_location}/${note.title}.md`;
			try {
				await this.app.vault.create(notePath, noteContent);
			} catch (error) {
				console.error(`Failed to create note at ${notePath}:`, error);
				new Notice(`⛔ Failed to create note: ${note.title}`);
			}
		}
	}

	private processTags(tags: string[]): string {
		return tags.map(tag => tag.replace(/ /g, "_").replace("#", "")).join(', ');
	}

	private generateNoteContent(note: any, filename: string, tags: string): string {
		return `---\nsource: "[[${filename}]]"\ntags: ${tags}\n---\n${note.body}`;
	}

	private async updateMoc() {
		if (!this.isApiKeyValid()) {
			return;
		}

		const fileName = await this.viewManager.getTitle();
		if (!fileName) {
			new Notice("⛔ Can't get title");
			return;
		}

		await this.embed.saveEmbeddings();
		await this.embed.searchRelatedNotes(fileName, fileName);
		new Notice(`✅ ${this.manifest.name}: finish`);
	}

	private createLoadingNotice(text: string, number = 100000): Notice {
		const notice = new Notice('', number);
		const loadingContainer = document.createElement('div');
		loadingContainer.addClass('loading-container');

		const loadingIcon = document.createElement('div');
		loadingIcon.addClass('loading-icon');
		const loadingText = document.createElement('span');
		loadingText.textContent = text;
		//@ts-ignore
		notice.noticeEl.empty();
		loadingContainer.appendChild(loadingIcon);
		loadingContainer.appendChild(loadingText);
		//@ts-ignore
		notice.noticeEl.appendChild(loadingContainer);

		return notice;
	}

	private convertToJsonArray(str: string): string {
		try {
			JSON.parse(str);
			return str;
		} catch (error) {
			// Not a valid JSON array, proceed with conversion
		}

		let parts = str.split('}').filter(part => part.trim() !== '');
		let jsonParts = parts.map(part => {
			try {
				return JSON.parse(part + '}');
			} catch (error) {
				throw new Error("Invalid JSON format");
			}
		});

		try {
			return JSON.stringify(jsonParts);
		} catch (error) {
			new Notice("⛔ Invalid return result from LLM");
			throw new Error("Invalid JSON format");
		}
	}
}
