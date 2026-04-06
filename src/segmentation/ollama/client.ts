import { requestUrl } from 'obsidian';

export class OllamaClient {
	private endpoint: string;

	constructor(endpoint: string) {
		this.endpoint = endpoint.replace(/\/+$/, '');
	}

	async healthCheck(): Promise<boolean> {
		try {
			const response = await requestUrl({
				url: this.endpoint,
				method: 'GET',
				throw: false,
			});
			return response.status === 200;
		} catch {
			return false;
		}
	}

	async listModels(): Promise<string[]> {
		try {
			const response = await requestUrl({
				url: `${this.endpoint}/api/tags`,
				method: 'GET',
				throw: false,
			});

			if (response.status !== 200) return [];

			const data = response.json;
			if (!data.models || !Array.isArray(data.models)) return [];

			return data.models.map((m: Record<string, unknown>) => m.name as string);
		} catch {
			return [];
		}
	}

	async generate(prompt: string, model: string): Promise<string> {
		const TIMEOUT_MS = 120_000;

		const request = requestUrl({
			url: `${this.endpoint}/api/generate`,
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model,
				prompt,
				stream: false,
			}),
			throw: false,
		});

		const timeout = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error(`Ollama request timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS);
		});

		const response = await Promise.race([request, timeout]);

		if (response.status !== 200) {
			throw new Error(`Ollama returned status ${response.status}`);
		}

		const data = response.json;
		if (!data.response) {
			throw new Error('Ollama returned empty response');
		}

		return data.response;
	}
}
