export const TRUSTED_ORIGINS = [
	"https://southbag.cc",
	"https://www.southbag.cc",
	"https://identity.southbag.cc",
	"http://localhost:4321",
	"http://127.0.0.1:4321",
	"http://localhost:5173",
	"https://127.0.0.1:5173",
];

export function isAllowedOrigin(origin: string | null): origin is string {
	if (!origin) return false;
	return TRUSTED_ORIGINS.includes(origin);
}

export function corsHeaders(origin: string | null, requestHeaders?: string | null): HeadersInit {
	if (!isAllowedOrigin(origin)) return {};

	const headers: Record<string, string> = {
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Credentials": "true",
		"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
		"Access-Control-Allow-Headers":
			requestHeaders ?? "Content-Type, Authorization, X-Requested-With",
		"Access-Control-Max-Age": "86400",
		Vary: "Origin",
	};

	return headers;
}

export function withCors(response: Response, origin: string | null): Response {
	const headers = corsHeaders(origin);
	if (Object.keys(headers).length === 0) return response;

	const next = new Response(response.body, response);
	for (const [key, value] of Object.entries(headers)) {
		next.headers.set(key, value);
	}
	return next;
}
