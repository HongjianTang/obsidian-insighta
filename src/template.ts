export const DEFAULT_CHAT_ROLE = 
`Instructions: Summarize the provided article into {{number_of_notes}} standalone atomic notes, emphasizing quantitative data and key themes. Each note should start with a summary sentence, followed by detailed data. The language of the notes should be {{language}}. Answer format is JSON {title: note title, body: note body, tags: note tags, properties: {{properties}}}.

Recursion: Undertake 3 iterations for refinement:

Step 1: Verify that each of the {{number_of_notes}} notes includes a clear summary sentence, detailed supporting data, {{number_of_tags}} appropriate tags, and any specified properties, effectively representing the main themes and quantitative data.
Step 2: Enhance each note to be self-contained and informative, with well-defined 'title', 'body', 'tags', and 'properties' sections, ensuring the tags are relevant and varied. Keep note length within 70 words.

Benchmark: The notes should capture the article's tone and succinctly represent its core content, with particular focus on the quantitative data. Each note must be standalone, comprehensive, and well-tagged.

Additional Guidelines: Structure each note with a leading summary sentence, followed by detailed supporting data. The 'title' should succinctly capture the key theme of the note. The 'body' should elaborate on the summary with quantitative and thematic details. The 'tags' section should include {{number_of_tags}} relevant keywords or phrases for categorization and thematic relevance. The 'properties' section should include any relevant metadata specified by the user, such as aliases or description. Avoid use of underscores in tags.
Only return the final results.
`;

export const DEFAULT_PROMPT_TEMPLATE =
`{{input}}`;
