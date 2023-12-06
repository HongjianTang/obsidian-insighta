import { App, MarkdownView, Editor, FrontMatterCache } from "obsidian";

export class ViewManager {
    app: App;

    constructor(app: App) {
        this.app = app;
    }

    async getSelection(editor?: Editor): Promise<string | null> {
        if (editor) {
            return editor.getSelection();
        }
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
            return activeView.editor.getSelection();
        }
        return null;
    }

    async getTitle(): Promise<string | null> {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
            return activeView.file.basename;
        }
        return null;
    }

    async getFrontMatter(): Promise<string | null> {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
            const file = activeView.file;
            const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as Partial<FrontMatterCache>;
            if (frontmatter?.position) {
                delete frontmatter.position;
            }
            return JSON.stringify(frontmatter);
        }
        return null;
    }

    async getContent(): Promise<string | null> {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
            // delete frontmatter
            let content = activeView.getViewData();
            const file = activeView.file;
            const frontmatter: FrontMatterCache | undefined = this.app.metadataCache.getFileCache(file)?.frontmatter;
            if (frontmatter) {
                content = content.split('---').slice(2).join('---');
            }
            return content;
        }
        return null;
    }

    async getTags(filterRegex?: string): Promise<string[] | null> {
        //@ts-ignore
        const tagsDict = this.app.metadataCache.getTags();
        let tags = Object.keys(tagsDict);
        if (!tags || tags.length == 0) return null;
        // remove #
        tags = tags.map((tag) => tag.replace(/^#/, ''));
        // filter
        if (filterRegex) {
            return tags.filter((tag) => RegExp(filterRegex).test(tag));
        }
        return tags;
    }

    async insertContentAtTop(content: string): Promise<void> {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        
        if (activeView) {
            const editor = activeView.editor;
            const file = activeView.file;
            const sections = this.app.metadataCache.getFileCache(file)?.sections;
            
            // get the line after frontmatter
            let topLine = 0; 
            if (sections && sections[0].type == "yaml") {
                topLine = sections[0].position.end.line + 1;
            }
            // replace top of the content
            editor.setCursor({line: topLine, ch: 0});
            editor.replaceSelection(`${content}\n`);
        }
    }
}