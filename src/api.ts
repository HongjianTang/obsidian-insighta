import { requestUrl, Notice } from "obsidian";

interface APIRequestParams {
	systemRole?: string;
	userPrompt?: string;
	model: string;
	temperature?: number;
	maxTokens?: number;
	topP?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
	input?: string;
}

interface ModelConfig {
	chatUrl: string;
	embeddingUrl: string;
}

class APIService {
	private static modelConfigs: { [key: string]: ModelConfig } = {
		"openai": {
			chatUrl: 'https://api.openai.com/v1/chat/completions',
			embeddingUrl: 'https://api.openai.com/v1/embeddings'
		},
		"glm": {
			chatUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
			embeddingUrl: 'https://open.bigmodel.cn/api/paas/v4/embeddings'
		},
		"bard": {
			chatUrl: 'https://bard.google.com/api/v1/chat/completions',
			embeddingUrl: 'https://bard.google.com/api/v1/embeddings'
		},
		"claude": {
			chatUrl: 'https://api.anthropic.com/v1/completions',
			embeddingUrl: 'https://api.anthropic.com/v1/embeddings'
		},
		"llama": {
			chatUrl: 'https://api.llama.ai/v1/chat/completions',
			embeddingUrl: 'https://api.llama.ai/v1/embeddings'
		}
	};

	static async request(url: string, headers: any, body: string): Promise<any> {
		console.log(`Sending request to ${url}.`);
		const response = await requestUrl({
			url: url,
			method: 'POST',
			headers: headers,
			body: body,
		});

		console.log(`Response status: ${response.status}.`);

		if (response.status >= 400) {
			new Notice(`API call error: ${response.status}`);
			throw new Error(`API call error: ${response.status}`);
		}

		console.log(`Received response: ${response.text}`);
		const data = JSON.parse(response.text);
		if (!data) {
			throw new Error('Invalid response format');
		}
		return data;
	}

	static getBaseUrl(model: string, type: "chat" | "embedding"): string {
		const provider = Object.keys(this.modelConfigs).find(key => model.includes(key)) || "glm";
		const config = this.modelConfigs[provider];
		return type === "chat" ? config.chatUrl : config.embeddingUrl;
	}
}

export class ChatGPT {
	private static getHeaders(): any {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			throw new Error("API key is not defined in environment variables");
		}
		return {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${apiKey}`,
		};
	}

	private static buildChatRequestBody(params: APIRequestParams): string {
		return JSON.stringify({
			model: params.model,
			messages: [
				{ "role": "system", "content": params.systemRole ?? "" },
				{ "role": "user", "content": params.userPrompt ?? "" },
			],
			temperature: params.temperature ?? 0,
			top_p: params.topP ?? 0.95,
			frequency_penalty: params.frequencyPenalty ?? 0,
			presence_penalty: params.presencePenalty ?? 0.5
		});
	}

	private static buildEmbeddingRequestBody(params: APIRequestParams): string {
		return JSON.stringify({
			model: params.model,
			input: params.input ?? "",
		});
	}

	static async callAPI(
		system_role: string,
		user_prompt: string,
		model: string,
		temperature = 0,
		max_tokens = 3000,
		top_p = 0.95,
		frequency_penalty = 0,
		presence_penalty = 0.5
	): Promise<string> {
		const headers = this.getHeaders();
		const body = this.buildChatRequestBody({
			systemRole: system_role,
			userPrompt: user_prompt,
			model: model,
			temperature: temperature,
			topP: top_p,
			frequencyPenalty: frequency_penalty,
			presencePenalty: presence_penalty,
		});

		const url = APIService.getBaseUrl(model, "chat");
		const data = await APIService.request(url, headers, body);
		if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
			throw new Error('Invalid response structure for chat completions');
		}
		return data.choices[0].message.content;
	}

	static async createEmbedding(input: string, model: string): Promise<number[]> {
		const headers = this.getHeaders();
		const body = this.buildEmbeddingRequestBody({ model: model, input: input });

		const url = APIService.getBaseUrl(model, "embedding");
		const data = await APIService.request(url, headers, body);

		if (!data.data || data.data.length === 0 || !data.data[0].embedding) {
			throw new Error('Invalid response structure for embeddings');
		}
		return data.data[0].embedding;
	}
}
