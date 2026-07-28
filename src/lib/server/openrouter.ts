import { env } from '$env/dynamic/private';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * The model Southbag Identity™ trusts with your entire face.
 */
export const SOUTHBAG_VISION_MODEL = 'google/gemini-3.5-flash';

type JsonSchema = Record<string, unknown>;

type ChatContentPart =
	| { type: 'text'; text: string }
	| { type: 'image_url'; image_url: { url: string } };

type ChatContent = string | Array<{ type?: string; text?: string }> | undefined;

type OpenRouterResponse = {
	error?: { message?: string };
	choices?: Array<{ message?: { content?: ChatContent } }>;
};

const flattenContent = (content: ChatContent) => {
	if (typeof content === 'string') return content;
	if (Array.isArray(content)) {
		return content
			.map((part) => (typeof part?.text === 'string' ? part.text : ''))
			.join('')
			.trim();
	}
	return '';
};

/**
 * Ask OpenRouter a question about some images and force a JSON answer back.
 *
 * Uses OpenRouter structured outputs (`response_format: json_schema`, strict) and
 * `provider.require_parameters` so we only get routed to providers that actually
 * honour the schema.
 */
export const generateJson = async <T>({
	prompt,
	images = [],
	schemaName,
	schema
}: {
	prompt: string;
	images?: string[];
	schemaName: string;
	schema: JsonSchema;
}): Promise<T> => {
	const apiKey = env.OPENROUTER_KEY;
	if (!apiKey) {
		throw new Error('OPENROUTER_KEY is not configured. Southbag cannot see you.');
	}

	const content: ChatContentPart[] = [
		{ type: 'text', text: prompt },
		...images.map((url) => ({ type: 'image_url' as const, image_url: { url } }))
	];

	const response = await fetch(OPENROUTER_ENDPOINT, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${apiKey}`,
			'content-type': 'application/json',
			'http-referer': env.ORIGIN || 'https://identity.southbag.cc',
			'x-title': 'Southbag Identity'
		},
		body: JSON.stringify({
			model: SOUTHBAG_VISION_MODEL,
			temperature: 0,
			provider: { require_parameters: true },
			response_format: {
				type: 'json_schema',
				json_schema: {
					name: schemaName,
					strict: true,
					schema
				}
			},
			messages: [{ role: 'user', content }]
		})
	});

	const payload = (await response.json().catch(() => null)) as OpenRouterResponse | null;

	if (!response.ok || payload?.error) {
		throw new Error(payload?.error?.message || `OpenRouter said no (${response.status})`);
	}

	const raw = flattenContent(payload?.choices?.[0]?.message?.content);
	if (!raw) {
		throw new Error('OpenRouter returned an empty answer.');
	}

	// Structured outputs should give us bare JSON, but strip fences just in case a
	// provider decides to be creative.
	const cleaned = raw
		.replace(/^\s*```(?:json)?/i, '')
		.replace(/```\s*$/, '')
		.trim();

	try {
		return JSON.parse(cleaned) as T;
	} catch {
		throw new Error('OpenRouter returned something that was not JSON.');
	}
};
