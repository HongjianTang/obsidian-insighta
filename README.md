# InsightA Obsidian Plugin :bulb: :books:

![GitHub release (latest by date)](https://img.shields.io/github/v/release/HongjianTang/obsidian-insighta?style=for-the-badge)
![GitHub all releases](https://img.shields.io/github/downloads/HongjianTang/obsidian-insighta/total?style=for-the-badge)

## Overview :mag:

InsightA is an Obsidian plugin, by using LLM, it can transform long articles into concise, atomic notes, and create well-organized Map of Content (MOC). This tool is ideal for anyone aiming to distill complex information into structured, interconnected notes, drawing inspiration from the Zettelkasten method. 🚀📝

## Features :sparkles:

- **AI-Powered Note Extraction**: Converts lengthy articles into atomic notes using advanced AI techniques.
- **Map of Content Generation**: Creates MOC based on note title, linking atomic notes for a better understanding of the subject matter.

## Installation :gear:

1. Open Obsidian and navigate to `Settings`.
2. In `Community Plugins`, turn off `Safe Mode`.
3. Click on `Browse Community Plugins` and search for `InsightA`.
4. Install and then enable InsightA in your community plugins list.

## Usage 💡

Before using, open setting, select a LLM and setup an API key.

### Extract Notes

Open an article for processing. Click the `InsightA` icon in the toolbar or use the command. The plugin will process the article, creating atomic notes that include links back to the source note and a set of relevant tags for easy organization and reference.

![Extract Notes](assets/use_case_extract_notes.gif)

### Create MOC

Open a new note file, use Create MOC command. The plugin will embed all notes in specific folder and note title, then find all related notes to the note title, group found notes using LLM and show them.
You can modify similar threshold in setting.

https://github.com/user-attachments/assets/c6480f4c-29a1-4d47-b3d5-ef2dbaad72f1

PS: Please note that processing times can vary depending on the length of the article. Typically, it takes about 30 seconds or longer for extensive articles. And GPT-4 is much better than GPT-3.5.

## Rodamap :hammer_and_wrench:

- [x] Model: Select different LLM model
- [x] Note Extraction: set number of generated notes
- [x] Note Extraction: set number of tags
- [x] Note Extraction: control the language of generated notes, with options for source or specific language input.
- [x] MOC: Modify similar threshold
- [ ] Model: add support to local LLM
- [ ] Note Extraction: let LLM decide how many notes should craete
- [x] Note Extraction: user can ask for additional properties like aliases, description, next and prev
- [ ] New feature: extract journals into well-organized tables

## Contributing :raised_hands:

Your contributions are what make the community amazing! If you have ideas, issues, or want to contribute, feel free to check the [issues page](https://github.com/HongjianTang/obsidian-insighta/issues) or submit a pull request.

## License :page_facing_up:

This project is under the [MIT License](LICENSE).

## Acknowledgements :tada:

- A huge thank you to the Obsidian community for their continuous support and insightful feedback.
- This tool is inspired by the Zettelkasten method, renowned for its efficient approach to knowledge management and organization.
- Special credits to [Liam's Periodic Notes Plugin](https://github.com/liamcain/obsidian-periodic-notes) and [HyeonseoNam's Auto Classifier](https://github.com/HyeonseoNam/auto-classifier/). Portions of their code were instrumental in the development of InsightA.

---

Crafted with :heart: by Hongjian Tang for the Obsidian community.
