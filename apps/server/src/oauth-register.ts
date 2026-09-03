const TRAILING_SLASHES = /\/+$/;

export function isOAuthRegisterPath(path: string): boolean {
	return path.replace(TRAILING_SLASHES, "").endsWith("/register");
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function withClientName(request: Request): Promise<Request> {
	if (
		request.method !== "POST" ||
		!isOAuthRegisterPath(new URL(request.url).pathname)
	) {
		return request;
	}
	let body: unknown;
	try {
		body = JSON.parse(await request.clone().text());
	} catch {
		return request;
	}
	if (!isJsonObject(body)) {
		return request;
	}
	const clientName = body.client_name;
	if (clientName !== undefined && clientName !== null) {
		return request;
	}
	const headers = new Headers(request.headers);
	headers.delete("content-length");
	return new Request(request.url, {
		method: request.method,
		headers,
		body: JSON.stringify({ ...body, client_name: "" }),
	});
}
