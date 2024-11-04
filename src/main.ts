import { Plugin, Notice } from "obsidian";
import { InsightASettingTab, InsightASettings, DEFAULT_SETTINGS } from "src/settings";
import { DEFAULT_PROMPT_TEMPLATE } from 'src/template';
import { ViewManager } from "src/view-manager";
import { ChatGPT } from 'src/api';
import { Embed } from 'src/embed';

enum InputMode {
	SelectedText,
	FullContent
}

export default class InsightAPlugin extends Plugin {
	settings: InsightASettings;
	embedManager: Embed;
	viewManager = new ViewManager(this.app);

	async onload() {
		await this.loadSettings();
		process.env.OPENAI_API_KEY = this.settings.commandOption.openai_key;
		this.embedManager = new Embed(this.app, this.viewManager, this.settings);

		this.registerPluginCommands();
		this.addSettingTab(new InsightASettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	saveSettingsNow() {
		this.saveData(this.settings);
	}

	onunload() {}

	private registerPluginCommands() {
		this.addCommand({
			id: 'create-notes-from-selection',
			name: 'Create Notes from Selected Text',
			callback: () => this.extractNotes(InputMode.SelectedText)
		});
		this.addCommand({
			id: 'create-notes-from-content',
			name: 'Create Notes from Full Content',
			callback: () => this.extractNotes(InputMode.FullContent)
		});
		this.addCommand({
			id: 'update-map-of-content',
			name: 'Update Map of Content',
			callback: () => this.updateMapOfContent()
		});
	}

	private async extractNotes(inputMode: InputMode) {
		const loadingNotice = this.showLoadingNotice(`${this.manifest.name}: Processing...`);
		try {
			await this.processNotes(inputMode);
		} catch (err) {
			console.error(err);
		} finally {
			loadingNotice.hide();
		}
	}

	private async processNotes(inputMode: InputMode) {
		if (!this.isApiKeyAvailable()) {
			return;
		}

		const noteInput = await this.getNoteInput(inputMode);
		if (!noteInput) {
			new Notice(`⛔ ${this.manifest.name}: No input data`);
			return;
		}

		const noteTitle = await this.viewManager.getTitle() ?? "Untitled";
		const userPrompt = this.generateUserPrompt(noteInput);
		const systemPrompt = this.generateSystemPrompt();

		try {
			const notesArray = await this.fetchNotesFromApi(systemPrompt, userPrompt);
			await this.createNotesFromArray(notesArray, noteTitle);
			new Notice(`✅ ${this.manifest.name}: Finished`);
		} catch (error) {
			console.error(error);
			new Notice(`⛔ ${this.manifest.name}: Failed to extract notes`);
		}
	}

	private isApiKeyAvailable(): boolean {
		if (!process.env.OPENAI_API_KEY) {
			new Notice(`⛔ ${this.manifest.name}: You need to input your API Key`);
			return false;
		}
		return true;
	}

	private async getNoteInput(inputMode: InputMode): Promise<string | null> {
		if (inputMode === InputMode.SelectedText) {
			return await this.viewManager.getSelection();
		} else if (inputMode === InputMode.FullContent) {
			return await this.viewManager.getContent();
		}
		return null;
	}

	private generateUserPrompt(input: string): string {
		let userPrompt = DEFAULT_PROMPT_TEMPLATE;
		return userPrompt.replace('{{input}}', input);
	}

	private generateSystemPrompt(): string {
		const { system_role, notes_quantity, tags_quantity, language_option, specific_language, properties } = this.settings.commandOption;
		return system_role
			.replace(/{{number_of_notes}}/g, notes_quantity.toString())
			.replace(/{{number_of_tags}}/g, tags_quantity.toString())
			.replace(/{{language}}/g, language_option === 'specific' ? specific_language : language_option)
			.replace(/{{properties}}/g, properties);
	}

	private async fetchNotesFromApi(systemPrompt: string, userPrompt: string): Promise<any[]> {
		let noteJsonString = await ChatGPT.callAPI(systemPrompt, userPrompt, this.settings.commandOption.llm_model);
		noteJsonString = noteJsonString.replace(/```json/g, "").replace(/```/g, "");
		noteJsonString = this.convertStringToJsonArray(noteJsonString);
		console.log(`noteJsonString: ${noteJsonString}`);
		let notesArray;
		try {
			notesArray = JSON.parse(noteJsonString);
		} catch (error) {
			throw new Error("Invalid JSON format");
		}
		if (!Array.isArray(notesArray)) {
			new Notice(`⛔ Returned JSON is not an array`);
			return [notesArray];
		}
		return notesArray;
	}

	private async createNotesFromArray(notesArray: any[], title: string) {
		for (const note of notesArray) {
			const tags = this.formatTags(note.tags);
			const noteContent = this.buildNoteContent(note, title, tags);
			const notePath = `${this.settings.commandOption.generated_notes_location}/${note.title}.md`;
			try {
				await this.app.vault.create(notePath, noteContent);
			} catch (error) {
				console.error(`Failed to create note at ${notePath}:`, error);
				new Notice(`⛔ Failed to create note: ${note.title}`);
			}
		}
	}

	private formatTags(tags: string[]): string {
		return tags.map(tag => tag.replace(/ /g, "_").replace("#", "")).join(', ');
	}

	private buildNoteContent(note: any, title: string, tags: string): string {
		let content = `---\nsource: "[[${title}]]"\ntags: ${tags}\n`;
		if (note.properties) {
			for (const [key, value] of Object.entries(note.properties)) {
				if (value !== null) {
					content += `${key}: ${Array.isArray(value) ? JSON.stringify(value) : value}\n`;
				}
			}
		}
		content += `---\n${note.body}`;
		return content;
	}

	private async updateMapOfContent() {
		if (!this.isApiKeyAvailable()) {
			return;
		}

		const noteTitle = await this.viewManager.getTitle();
		if (!noteTitle) {
			new Notice("⛔ Unable to retrieve title");
			return;
		}

		await this.embedManager.saveEmbeddings();
		await this.embedManager.searchRelatedNotes(noteTitle, noteTitle);
		new Notice(`✅ ${this.manifest.name}: Finished`);
	}

	private showLoadingNotice(text: string, duration = 100000): Notice {
		const notice = new Notice('', duration);
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

	private convertStringToJsonArray(str: string): string {
		try {
			JSON.parse(str);
			return str;
		} catch (error) {}

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
