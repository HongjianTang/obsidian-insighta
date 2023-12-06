import { Plugin, Notice } from "obsidian";
import { InsightASettingTab, InsightASettings, DEFAULT_SETTINGS} from "src/settings";
import { ViewManager } from "src/view-manager";
import { ChatGPT } from 'src/api';

enum InputType {
	SelectedArea,
	Content
}

export default class InsightAPlugin extends Plugin {
	settings: InsightASettings;
	viewManager = new ViewManager(this.app);

	async onload() {
		await this.loadSettings();

		// Buttons
		const extractIconEl = this.addRibbonIcon('dice', `${this.manifest.name}: Extract Notes`, async (evt: MouseEvent) => {
			await this.runExtractNotes(InputType.Content);
		});

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
		if (!this.settings.apiKey) {
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

		// format prompt
		let user_prompt = this.settings.commandOption.prompt_template;
		user_prompt = user_prompt.replace('{{input}}', input);

		const system_role = this.settings.commandOption.system_role;

		// ------- [LLM Processing] -------
		// Call API
		let responseRaw = await ChatGPT.callAPI(system_role, user_prompt, this.settings.apiKey, this.settings.commandOption.llm_model);
		let noteJsonString =  JSON.parse(responseRaw).choices[0].message.content;
		noteJsonString = noteJsonString.replace("```json", "");
		noteJsonString = noteJsonString.replace("```", "");
		// new Notice(noteJsonString);
		let noteArray = JSON.parse(noteJsonString);
		if (!Array.isArray(noteArray)) {
			new Notice(`⛔ return json is not array`);
			noteArray = [noteArray]
		}

		for (const note of noteArray){
			// new Notice(JSON.stringify(note));
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
}

