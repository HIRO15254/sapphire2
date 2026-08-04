/**
 * Consent enforcement for the MCP OAuth provider.
 *
 * better-auth's mcp() authorize endpoint only routes through a consent step
 * when the CLIENT sends prompt=consent — otherwise an authenticated
 * browser hitting an authorize URL is silently issued a code, and the token
 * endpoint never re-checks consent. Since DCR is open to anyone, that would
 * let any registered client obtain user data with zero interaction. The
 * Worker therefore rewrites every authorize request to prompt=consent before
 * handing it to better-auth.
 */

/** Force prompt=consent on an authorize URL (overwrites any client value). */
export function forceConsentPrompt(url: string): string {
	const parsed = new URL(url);
	parsed.searchParams.set("prompt", "consent");
	return parsed.toString();
}

const TRAILING_SLASHES = /\/+$/;

/**
 * Whether a better-auth path is an authorization endpoint that must be forced
 * through consent. Matched by suffix and applied to every method, so a
 * better-auth upgrade that adds a second authorize route (or accepts POST on
 * the existing one) cannot silently open a path around the consent gate.
 */
export function isAuthorizePath(path: string): boolean {
	return path.replace(TRAILING_SLASHES, "").endsWith("/authorize");
}

/**
 * Hosts an authorization code can be delivered to, from the DCR row's
 * comma-joined `redirect_urls`. Unparseable entries are dropped rather than
 * shown: the value is attacker-controlled and the consent page must not
 * render free text supplied by a registered client.
 */
export function redirectHostsFrom(
	redirectUrls: string | null | undefined
): string[] {
	if (!redirectUrls) {
		return [];
	}
	const hosts = new Set<string>();
	for (const candidate of redirectUrls.split(",")) {
		const trimmed = candidate.trim();
		if (!trimmed) {
			continue;
		}
		try {
			const { host } = new URL(trimmed);
			// Opaque URIs (urn:, mailto:) parse but have no host — treat them as
			// unknown so the consent page shows its "no recognizable
			// destination" warning instead of an empty destination.
			if (host) {
				hosts.add(host);
			}
		} catch {
			// Not a URL — show nothing for it.
		}
	}
	return [...hosts];
}

export interface ConsentPageQuery {
	clientId: string;
	code: string;
}

/**
 * Parse the query better-auth appends when redirecting to the consent page.
 * Returns null when the request did not come through the authorize flow.
 *
 * The `scope` parameter is deliberately not read: scopes are not used for
 * authorization (see mcp-tools.md rule 8), so the consent page describes the
 * real tool capability instead — surfacing scopes here would only invite
 * showing them again.
 */
export function parseConsentPageQuery(url: string): ConsentPageQuery | null {
	const params = new URL(url).searchParams;
	const code = params.get("consent_code");
	const clientId = params.get("client_id");
	if (!(code && clientId)) {
		return null;
	}
	return { clientId, code };
}
