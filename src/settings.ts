import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { ChatGPT } from 'src/api';
import type InsightAPlugin from "src/main";
import { DEFAULT_CHAT_ROLE, DEFAULT_PROMPT_TEMPLATE, DEFAULT_PROMPT_TEMPLATE_WO_REF } from 'src/template'
import { FolderSuggest } from "src/folder-suggester";


// for tag, keyword
export interface CommandOption {
    openai_key: string;
    useRef: boolean;
    system_role: string;
    prompt_template: string;
    generated_notes_location: string;
    llm_model: string;
    embedding_location: string;
    source_notes_location: string;
    similar_threshold: number;
}

export class InsightASettings {
    apiKeyCreatedAt: Date | null;
    commandOption: CommandOption;
}

export const DEFAULT_SETTINGS: InsightASettings = {
    apiKeyCreatedAt: null,
    commandOption: {
        openai_key: "",
        useRef: false,
        system_role: DEFAULT_CHAT_ROLE,
        prompt_template: DEFAULT_PROMPT_TEMPLATE,
        generated_notes_location: "Atomic Notes",
        llm_model: "gpt-3.5-turbo",
        embedding_location: "Embeddings/",
        source_notes_location: "Cards/",
        similar_threshold: 0.76,
    },
};

export class InsightASettingTab extends PluginSettingTab {
    plugin: InsightAPlugin;
    constructor(app: App, plugin: InsightAPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async display(): Promise<void> {

        const { containerEl } = this;
        const commandOption = this.plugin.settings.commandOption;

        containerEl.empty();

        // ------- [LLM Setting] -------
        containerEl.createEl('h2', { text: 'LLM' });
        // API Key input        
        const apiKeySetting = new Setting(containerEl)
            .setName('OpenAI API key')
            .setDesc('')
            .addText((text) =>
                text
                    .setPlaceholder('OpenAI API key')
                    .setValue(commandOption.openai_key!)
                    .onChange((value) => {
                        commandOption.openai_key = value;
                        process.env.OPENAI_API_KEY = value;
                        this.plugin.saveSettings();
                    })
            )

        // API Key Description & Message
        apiKeySetting.descEl.createSpan({text: 'Enter your ChatGPT API key. If you don\'t have one yet, you can create it at '});
        apiKeySetting.descEl.createEl('a', {href: 'https://platform.openai.com/account/api-keys', text: 'here'})
        const apiTestMessageEl = document.createElement('div');
        apiKeySetting.descEl.appendChild(apiTestMessageEl);

        //API Key default message
        if (commandOption.openai_key && this.plugin.settings.apiKeyCreatedAt) {
            apiTestMessageEl.setText(`This key was tested at ${this.plugin.settings.apiKeyCreatedAt.toString()}`);
            apiTestMessageEl.style.color = 'var(--success-color)';
        }

        // API Key test button
        apiKeySetting.addButton((cb) => {
            cb.setButtonText('Test API call')
                .setCta()
                .onClick(async () => {
                    this.plugin.settings.apiKeyCreatedAt
                    apiTestMessageEl.setText('Testing api call...');
                    apiTestMessageEl.style.color = 'var(--text-normal)';
                    try {
                        await ChatGPT.callAPI('', 'test', commandOption.llm_model);
                        apiTestMessageEl.setText('Success! API working.');
                        apiTestMessageEl.style.color = 'var(--success-color)';
                        this.plugin.settings.apiKeyCreatedAt = new Date();
                    } catch (error) {
                        apiTestMessageEl.setText(`Error: API is not working. ${error}`);
                        apiTestMessageEl.style.color = 'var(--warning-color)';
                        this.plugin.settings.apiKeyCreatedAt = null;
                    }
                });
        });

        // Select LLM Model
        new Setting(containerEl)
            .setName('LLM model')
            .setDesc('Specify LLM model')
            .addDropdown((cb) => {
                cb.addOption('gpt-3.5-turbo-1106', 'gpt-3.5-turbo-1106')
                    .addOption('gpt-4-1106-preview', 'gpt-4-turbo')
                    .setValue(String(commandOption.llm_model))
                    .onChange(async (value) => {
                        commandOption.llm_model = value;
                        await this.plugin.saveSettings();
                        this.display();
                    });
            });

        // ------- [Create Setting] -------
        containerEl.createEl('h2', { text: 'Create atomic notes' });
        this.add_generated_notes_location();
        
        // Toggle Use Exist Tags
        // new Setting(containerEl)
        // .setName('Use Exist Tags')
        // .setDesc('If not, it will recommend new tags')
        // .addToggle((toggle) =>
        //     toggle
        //         .setValue(commandOption.useRef)
        //         .onChange(async (value) => {
        //             commandOption.useRef = value;
        //             await this.plugin.saveSettings();
        //             this.display();
        //         }),
        // );
        



        // ------- [Custom Prompt] -------
        // Different default template depanding on useRef
        if (commandOption.useRef) {
            if(commandOption.prompt_template == DEFAULT_PROMPT_TEMPLATE_WO_REF) commandOption.prompt_template = DEFAULT_PROMPT_TEMPLATE;
        } else {
            if(commandOption.prompt_template == DEFAULT_PROMPT_TEMPLATE) commandOption.prompt_template = DEFAULT_PROMPT_TEMPLATE_WO_REF;
        }

        const customChatRoleEl = new Setting(containerEl)
            .setName('Custom prompt')
            .setDesc('')
            .setClass('setting-item-child')
            .setClass('block-control-item')
            .setClass('height30-text-area')
            .addTextArea((text) =>
                text
                    .setPlaceholder('Write custom prompt.')
                    .setValue(commandOption.system_role)
                    .onChange(async (value) => {
                        commandOption.system_role = value;
                        await this.plugin.saveSettings();
                    })
            )
            .addExtraButton(cb => {
                cb
                    .setIcon('reset')
                    .setTooltip('Restore to default')
                    .onClick(async () => {
                        commandOption.system_role = DEFAULT_CHAT_ROLE;
                        await this.plugin.saveSettings();
                        this.display();
                    })
            });
            customChatRoleEl.descEl.createSpan({text: 'Custom system message to LLM.'});
        
        // ------- [MOC] -------
        containerEl.createEl('h2', { text: 'Create MOC' });
        this.add_embedding_location();
        this.add_source_notes_location();
        new Setting(containerEl)
            .setName('Similar threshold for moc')
            .setDesc('')
            .addText((text) =>
                text
                    .setValue(`${commandOption.similar_threshold}`)
                    .onChange((value) => {
                        commandOption.similar_threshold = Number(value);
                        this.plugin.saveSettings();
                    })
            )
    }

    add_generated_notes_location(): void {
        new Setting(this.containerEl)
            .setName("Generated notes folder")
            .setDesc("Generated notes folder.")
            .addSearch((cb) => {
                new FolderSuggest(cb.inputEl);
                cb.setPlaceholder("Example: folder1/folder2")
                    .setValue(this.plugin.settings.commandOption.generated_notes_location)
                    .onChange((new_folder) => {
                        this.plugin.settings.commandOption.generated_notes_location = new_folder;
                        this.plugin.saveSettingsInstant();
                    });
                // @ts-ignore
                cb.containerEl.addClass("templater_search");
            });
    }

    add_embedding_location():void{
        new Setting(this.containerEl)
        .setName("Embedding files folder")
        .setDesc("Embedding files folder.")
        .addSearch((cb) => {
            new FolderSuggest(cb.inputEl);
            cb.setValue(this.plugin.settings.commandOption.embedding_location)
                .onChange((new_folder) => {
                    this.plugin.settings.commandOption.embedding_location = new_folder;
                    this.plugin.saveSettingsInstant();
                });
            // @ts-ignore
            cb.containerEl.addClass("templater_search");
        });
    }

    add_source_notes_location():void{
        new Setting(this.containerEl)
        .setName("Source notes folder")
        .setDesc("Source notes folder.")
        .addSearch((cb) => {
            new FolderSuggest(cb.inputEl);
            cb.setValue(this.plugin.settings.commandOption.source_notes_location)
                .onChange((new_folder) => {
                    this.plugin.settings.commandOption.source_notes_location = new_folder;
                    this.plugin.saveSettingsInstant();
                });
            // @ts-ignore
            cb.containerEl.addClass("templater_search");
        });
    }
}