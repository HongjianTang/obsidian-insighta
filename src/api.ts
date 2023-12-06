import { requestUrl, Notice } from "obsidian";
export class ChatGPT {
	private static baseUrl = 'https://api.openai.com/v1/chat/completions';

	static async callAPI(
		system_role: string,
		user_prompt: string,
		apiKey: string,
		model = "gpt-4-1106-preview",
		// model = "gpt-3.5-turbo",
		temperature = 0,
		max_tokens = 2000,
		top_p = 0.95,
		frequency_penalty = 0,
		presence_penalty = 0.5): Promise<string> {

		const headers = {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${apiKey}`,
		};

		const body = JSON.stringify({
			model: model,
			messages: [
				{ "role": "system", "content": system_role },
				{ "role": "user", "content": user_prompt },
			],
			max_tokens: max_tokens,
			n: 1,
			stop: null,
			temperature: temperature,
			top_p: top_p,
			frequency_penalty: frequency_penalty,
			presence_penalty: presence_penalty
		});

		// new Notice('Sent message to llm api.');
		const response = await requestUrl({
			url: this.baseUrl,
			method: 'POST',
			headers: headers,
			body: body,
		});

		if (response.status >= 400) {
			throw new Error(`API call error: ${response.status}`);
		}

		// new Notice('Successful receieve message from llm api.');
		const data = JSON.parse(response.text);
		return response.text;
		return data.choices[0].message.content;
	}
}