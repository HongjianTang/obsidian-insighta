import { Plugin, Notice } from "obsidian";
import { InsightASettingTab, InsightASettings, DEFAULT_SETTINGS} from "src/settings";
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
		this.embed = new Embed(this.app,this.viewManager,this.settings);

		// Buttons
		// const extractIconEl = this.addRibbonIcon('dice', `${this.manifest.name}: extract notes`, async (evt: MouseEvent) => {
		// 	await this.runExtractNotes(InputType.Content);
		// });

		// Commands
		this.addCommand({
			id: 'create-atomic-notes-selected',
			name: 'Create atomic notes from Selected Area',
			callback: async () => {
				await this.runExtractNotes(InputType.SelectedArea);
			}
		});
		this.addCommand({
			id: 'create-atomic-notes-content',
			name: 'Create atomic notes from Note Content',
			callback: async () => {
				await this.runExtractNotes(InputType.Content);
			}
		});

		this.addCommand({
			id: 'update-moc',
			name: 'Update moc',
			callback: async () => {
				await this.updateMoc();
			}
		});

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

	async onunload() {
	}

	async runExtractNotes(inputType: InputType) {
		const loadingNotice = this.createLoadingNotice(`${this.manifest.name}: Processing..`);
		try {
			await this.extractNotes(inputType);
			loadingNotice.hide();
		} catch (err) {
			loadingNotice.hide();
		}
	}

	// Main Classification
	async extractNotes(inputType: InputType) {
		// ------- [API Key check] -------
		if (!process.env.OPENAI_API_KEY) {
			new Notice(`⛔ ${this.manifest.name}: You shuld input your API Key`);
			return null
		}

		// ------- [Input] -------
		// Set Input 
		let input: string | null = '';
		if (inputType == InputType.SelectedArea) {
			input = await this.viewManager.getSelection();
		}
		else if (inputType == InputType.Content) {
			input = await this.viewManager.getContent();
		}

		const filename = await this.viewManager.getTitle();

		// input error
		if (!input) {
			new Notice(`⛔ ${this.manifest.name}: no input data`);
			return null;
		}

		// ------- [LLM Processing] -------
		// format prompt
		let user_prompt = this.settings.commandOption.prompt_template;
		user_prompt = user_prompt.replace('{{input}}', input);
		const system_role = this.settings.commandOption.system_role;

		// Call API
		let noteJsonString = await ChatGPT.callAPI(system_role, user_prompt, this.settings.commandOption.llm_model);
		noteJsonString = noteJsonString.replace("```json", "");
		noteJsonString = noteJsonString.replace("```", "");
		noteJsonString = this.convertToJsonArray(noteJsonString);
		console.log(noteJsonString);
		let noteArray = JSON.parse(noteJsonString);
		if (!Array.isArray(noteArray)) {
			new Notice(`⛔ return json is not array`);
			noteArray = [noteArray]
		}

		for (const note of noteArray){
			let processedTag = '';
			for (let tag of note.tags){
				tag = tag.replace(/ /g, "_")
				tag = tag.replace("#", "")
				processedTag = processedTag + tag +', ';
			}
			if (processedTag.endsWith(', ')) {
				processedTag = processedTag.slice(0, -2);
			}
			let noteContent = `---\nsource: "[[${filename}]]"\ntags: ${processedTag}\n---`
			noteContent = noteContent + `\n${note.body}`
			const notePath = this.settings.commandOption.generated_notes_location+`/${note.title}.md`;
			this.app.vault.create(notePath, noteContent);
		}

		new Notice(`✅ ${this.manifest.name}: finish`);
	}

	async updateMoc(){
		// ------- [API Key check] -------
		if (!process.env.OPENAI_API_KEY) {
			new Notice(`⛔ ${this.manifest.name}: You shuld input your API Key`);
			return null
		}

		const fileName = await this.viewManager.getTitle();
	
		await this.embed.saveEmbeddings();
		let topic = await this.viewManager.getTitle();
		if (!topic){
			new Notice("⛔ Can't get title");
			return;
		}
		
		await this.embed.searchRelatedNotes(topic, fileName!);
		new Notice(`✅ ${this.manifest.name}: finish`);
	}

	// create loading spin in the Notice message
	createLoadingNotice(text: string, number = 100000): Notice {
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

	convertToJsonArray(str: string): string {
		// Check if the string is already a valid JSON array
		try {
			JSON.parse(str);
			return str; // It's already a valid JSON array
		} catch (error) {
			// Not a valid JSON array, proceed with conversion
		}
	
		// Split the string by '}' and filter out empty elements
		let parts = str.split('}').filter(part => part.trim() !== '');
	
		// Add the missing '}' back to each part and convert to JSON objects
		let jsonParts = parts.map(part => {
			try {
				return JSON.parse(part + '}');
			} catch (error) {
				throw new Error("Invalid JSON format");
			}
		});
	
		// Convert the array of JSON objects to a JSON string
		return JSON.stringify(jsonParts);
	}
}
