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
    notes_quantity: string;
    tags_quantity: string;
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
        llm_model: "gpt-4o-mini",
        embedding_location: "Embeddings/",
        source_notes_location: "Cards/",
        similar_threshold: 0.76,
        notes_quantity: "1",
        tags_quantity: "2-3",
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
        containerEl.empty();

        this.createLLMSettings(containerEl);
        this.createAtomicNotesSettings(containerEl);
        this.createNotesQuantitySetting(containerEl);
        this.createTagsQuantitySetting(containerEl);
        this.createCustomPromptSettings(containerEl);
        this.createMOCSettings(containerEl);
    }

    createLLMSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h2', { text: 'LLM' });
        this.createAPIKeySetting(containerEl);
        this.createLLMModelSetting(containerEl);
    }

    createAPIKeySetting(containerEl: HTMLElement): void {
        const commandOption = this.plugin.settings.commandOption;
        const apiKeySetting = new Setting(containerEl)
            .setName('API key')
            .addText((text) =>
                text
                    .setPlaceholder('OpenAI API key')
                    .setValue(commandOption.openai_key!)
                    .onChange((value) => this.updateAPIKey(value))
            );

        apiKeySetting.descEl.createSpan({ text: 'Enter your ChatGPT API key. If you don\'t have one yet, you can create it at ' });
        apiKeySetting.descEl.createEl('a', { href: 'https://platform.openai.com/account/api-keys', text: 'here' });
        const apiTestMessageEl = document.createElement('div');
        apiKeySetting.descEl.appendChild(apiTestMessageEl);

        if (commandOption.openai_key && this.plugin.settings.apiKeyCreatedAt) {
            apiTestMessageEl.setText(`This key was tested at ${this.plugin.settings.apiKeyCreatedAt.toString()}`);
            apiTestMessageEl.style.color = 'var(--success-color)';
        }

        apiKeySetting.addButton((cb) => {
            cb.setButtonText('Test API call')
                .setCta()
                .onClick(() => this.testAPIKey(apiTestMessageEl));
        });
    }

    updateAPIKey(value: string): void {
        this.plugin.settings.commandOption.openai_key = value;
        process.env.OPENAI_API_KEY = value;
        this.plugin.saveSettings();
    }

    async testAPIKey(apiTestMessageEl: HTMLElement): Promise<void> {
        const commandOption = this.plugin.settings.commandOption;
        apiTestMessageEl.setText('Testing api call...');
        apiTestMessageEl.style.color = 'var(--text-normal)';
        try {
            await ChatGPT.callAPI('', 'test', commandOption.llm_model);
            apiTestMessageEl.setText('Success! API working.');
            apiTestMessageEl.style.color = 'var(--success-color)';
            this.plugin.settings.apiKeyCreatedAt = new Date();
            await this.plugin.saveSettings(); // Ensure this value is persisted
        } catch (error) {
            apiTestMessageEl.setText(`Error: API is not working. ${error}`);
            apiTestMessageEl.style.color = 'var(--warning-color)';
            this.plugin.settings.apiKeyCreatedAt = null;
            await this.plugin.saveSettings(); // Ensure this value is persisted
        }
    }

    createLLMModelSetting(containerEl: HTMLElement): void {
        const commandOption = this.plugin.settings.commandOption;
        const availableModels = [
            { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
            { value: 'gpt-4o', label: 'gpt-4o' },
            { value: 'glm-4-flash', label: 'glm-4-flash' },
            { value: 'glm-4-plus', label: 'glm-4-plus' },
            { value: 'llama-2', label: 'llama-2' },
            { value: 'bard', label: 'Bard' },
            { value: 'claude', label: 'Claude' },
        ];

        new Setting(containerEl)
            .setName('LLM model')
            .setDesc('Specify LLM model')
            .addDropdown((cb) => {
                availableModels.forEach(model => {
                    cb.addOption(model.value, model.label);
                });
                cb.setValue(String(commandOption.llm_model))
                    .onChange(async (value) => {
                        commandOption.llm_model = value;
                        await this.plugin.saveSettings();
                        this.display();
                    });
            });
    }

    createAtomicNotesSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h2', { text: 'Create atomic notes' });
        this.addGeneratedNotesLocation(containerEl);
    }

    addGeneratedNotesLocation(containerEl: HTMLElement): void {
        new Setting(containerEl)
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

    createCustomPromptSettings(containerEl: HTMLElement): void {
        const commandOption = this.plugin.settings.commandOption;
        containerEl.createEl('h2', { text: 'Custom prompt' });
        this.updatePromptTemplateBasedOnUseRef();

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
        customChatRoleEl.descEl.createSpan({ text: 'Custom system message to LLM.' });
    }

    updatePromptTemplateBasedOnUseRef(): void {
        const commandOption = this.plugin.settings.commandOption;
        if (commandOption.useRef) {
            if (commandOption.prompt_template === DEFAULT_PROMPT_TEMPLATE_WO_REF) {
                commandOption.prompt_template = DEFAULT_PROMPT_TEMPLATE;
            }
        } else {
            if (commandOption.prompt_template === DEFAULT_PROMPT_TEMPLATE) {
                commandOption.prompt_template = DEFAULT_PROMPT_TEMPLATE_WO_REF;
            }
        }
    }

    updateCustomPrompt(value: string): void {
        this.plugin.settings.commandOption.system_role = value;
        this.plugin.saveSettings();
    }

    resetCustomPrompt(): void {
        this.plugin.settings.commandOption.system_role = DEFAULT_CHAT_ROLE;
        this.plugin.saveSettings();
        this.display();
    }

    createMOCSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h2', { text: 'Create MOC' });
        this.addEmbeddingLocation(containerEl);
        this.addSourceNotesLocation(containerEl);
        this.addSimilarThresholdSetting(containerEl);
    }

    addEmbeddingLocation(containerEl: HTMLElement): void {
        new Setting(containerEl)
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

    addSourceNotesLocation(containerEl: HTMLElement): void {
        new Setting(containerEl)
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

    addSimilarThresholdSetting(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName('Similar threshold for moc')
            .addText((text) =>
                text
                    .setValue(`${this.plugin.settings.commandOption.similar_threshold}`)
                    .onChange((value) => {
                        this.plugin.settings.commandOption.similar_threshold = Number(value);
                        this.plugin.saveSettings();
                    })
            );
    }

    createNotesQuantitySetting(containerEl: HTMLElement): void {
        const commandOption = this.plugin.settings.commandOption;
        new Setting(containerEl)
            .setName('Number of notes to generate')
            .setDesc('Choose how many notes are generated')
            .addDropdown((cb) => {
                cb.addOption('1', '1');
                cb.addOption('around 3', 'around 3');
                cb.addOption('around 5', 'around 5');
                cb.addOption('around 8', 'around 8');
                cb.setValue(commandOption.notes_quantity)
                    .onChange(async (value) => {
                        commandOption.notes_quantity = value;
                        commandOption.system_role = commandOption.system_role.replace(/\bnumber of notes: \d+\b/, `number of notes: ${value}`);
                        await this.plugin.saveSettings();
                    });
            });
    }

    createTagsQuantitySetting(containerEl: HTMLElement): void {
        const commandOption = this.plugin.settings.commandOption;
        new Setting(containerEl)
            .setName('Number of tags per note')
            .setDesc('Choose how many tags each note should have')
            .addDropdown((cb) => {
                cb.addOption('0', '0');
                cb.addOption('2-3', '2-3');
                cb.addOption('5-8', '5-8');
                cb.setValue(commandOption.tags_quantity)
                    .onChange(async (value) => {
                        commandOption.tags_quantity = value;
                        commandOption.system_role = commandOption.system_role.replace(/\bnumber of tags: \d+-\d+\b/, `number of tags: ${value}`);
                        await this.plugin.saveSettings();
                    });
            });
    }
}
