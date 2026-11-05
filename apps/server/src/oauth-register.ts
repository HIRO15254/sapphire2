const TRAILING_SLASHES = /\/+$/;

export function isOAuthRegisterPath(path: string): boolean {
	return path.replace(TRAILING_SLASHES, "").endsWith("/register");
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const UNSAFE_REDIRECT_PROTOCOLS: Record<string, true> = {
	"javascript:": true,
	"data:": true,
	"vbscript:": true,
	"file:": true,
	"blob:": true,
	"about:": true,
};

export async function hasUnsafeRedirectUri(request: Request): Promise<boolean> {
	if (
		request.method !== "POST" ||
		!isOAuthRegisterPath(new URL(request.url).pathname)
	) {
		return false;
	}
	let body: unknown;
	try {
		body = await request.clone().json();
	} catch {
		return false;
	}
	if (!(isJsonObject(body) && Array.isArray(body.redirect_uris))) {
		return false;
	}
	return body.redirect_uris.some((uri: unknown) => {
		if (typeof uri !== "string") {
			return false;
		}
		if (uri.includes(",")) {
			return true;
		}
		try {
			const url = new URL(uri);
			return (
				UNSAFE_REDIRECT_PROTOCOLS[url.protocol] === true ||
				(url.protocol === "http:" &&
					!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
			);
		} catch {
			return true;
		}
	});
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
