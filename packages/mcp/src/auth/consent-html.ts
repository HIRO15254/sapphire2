import { toolPermissionSummary } from "../tools/registry";

/**
 * OAuth consent page, served by the Worker's `GET /oauth/consent` route
 * (better-auth's `oidcConfig.consentPage` redirects the browser there).
 *
 * Dynamic client registration is open to anyone (standard MCP posture), so
 * every client-supplied value is hostile input: the name and redirect hosts
 * are HTML-escaped, and nothing else the client registered (icon, metadata)
 * is rendered at all. The consent code is embedded as JSON with `<` escaped
 * so a crafted code can never terminate the script element.
 *
 * The page describes the REAL capability of the token being issued, derived
 * from the tool catalogue — not the OAuth scopes, which are not used for
 * authorization (see buildMcpSession) and would under-represent the grant.
 */

export interface ConsentHtmlProps {
	clientId: string;
	clientName: string;
	code: string;
	/** Hosts the authorization code will be delivered to, from the DCR row. */
	redirectHosts: string[];
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

/** JSON string safe to place inside a <script> element. */
function scriptSafeJson(value: unknown): string {
	return JSON.stringify(value).replaceAll("<", "\\u003c");
}

const STYLES = `
	:root { color-scheme: light dark; }
	body { margin: 0; min-height: 100dvh; display: grid; place-items: center;
		font-family: system-ui, sans-serif; background: #f4f4f5; color: #18181b; }
	main { background: #fff; border: 1px solid #e4e4e7; border-radius: 12px;
		padding: 2rem; max-width: 26rem; width: calc(100% - 2rem); box-sizing: border-box; }
	h1 { font-size: 1.125rem; margin: 0 0 0.75rem; }
	p { margin: 0 0 1rem; line-height: 1.5; }
	ul { margin: 0 0 1rem; padding-left: 1.25rem; }
	li { line-height: 1.6; }
	.destination { font-size: 0.875rem; color: #52525b; margin-bottom: 1.5rem; }
	.destination code { font-family: ui-monospace, monospace; }
	.actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
	button { font: inherit; border-radius: 8px; padding: 0.5rem 1.25rem; cursor: pointer; }
	#approve { background: #2563eb; border: 1px solid #2563eb; color: #fff; }
	#deny { background: transparent; border: 1px solid #d4d4d8; color: inherit; }
	#error { color: #dc2626; }
	@media (prefers-color-scheme: dark) {
		body { background: #18181b; color: #fafafa; }
		main { background: #27272a; border-color: #3f3f46; }
		.destination { color: #a1a1aa; }
		#deny { border-color: #52525b; }
	}
`;

const SCRIPT = `
	const data = JSON.parse(document.getElementById("consent-data").textContent);
	async function decide(accept) {
		document.getElementById("approve").disabled = true;
		document.getElementById("deny").disabled = true;
		try {
			const response = await fetch("/api/auth/oauth2/consent", {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ accept, consent_code: data.code }),
			});
			if (!response.ok) { throw new Error("consent request failed"); }
			const { redirectURI } = await response.json();
			window.location.href = redirectURI;
		} catch {
			document.getElementById("error").hidden = false;
			document.getElementById("approve").disabled = false;
			document.getElementById("deny").disabled = false;
		}
	}
	document.getElementById("approve").addEventListener("click", () => decide(/* accept: true */ true));
	document.getElementById("deny").addEventListener("click", () => decide(/* accept: false */ false));
`;

function renderDestination(redirectHosts: string[]): string {
	if (redirectHosts.length === 0) {
		return '<p class="destination">This application did not register a recognizable destination. Only approve it if you started this yourself.</p>';
	}
	const hosts = redirectHosts
		.map((host) => `<code>${escapeHtml(host)}</code>`)
		.join(", ");
	return `<p class="destination">Your data will be sent to ${hosts}. Anyone can register an application under any name — check this destination before approving.</p>`;
}

export function renderConsentHtml(props: ConsentHtmlProps): string {
	const clientName = escapeHtml(
		props.clientName.trim() || "Unknown application"
	);
	const permissionItems = toolPermissionSummary()
		.map((permission) => `<li>${escapeHtml(permission)}</li>`)
		.join("");
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Authorize access — sapphire2</title>
<style>${STYLES}</style>
</head>
<body>
<main>
<h1>Authorization request</h1>
<p><strong>${clientName}</strong> is asking for access to your sapphire2 account. If you approve, it will be able to:</p>
<ul>${permissionItems}</ul>
${renderDestination(props.redirectHosts)}
<div class="actions">
<button id="deny" type="button">Deny</button>
<button id="approve" type="button">Approve</button>
</div>
<p id="error" hidden>Something went wrong. Close this page and try connecting again.</p>
</main>
<script type="application/json" id="consent-data">${scriptSafeJson({ code: props.code })}</script>
<script>${SCRIPT}</script>
</body>
</html>`;
}
