import { toolPermissionSummary } from "../tools/registry";

export interface ConsentHtmlProps {
	clientId: string;
	clientName: string;
	code: string;
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

function scriptSafeJson(value: unknown): string {
	return JSON.stringify(value).replaceAll("<", "\\u003c");
}

const STYLES = `
	:root {
		color-scheme: light;
		--background: #fcfcfd; --foreground: #282a30; --card: #ffffff;
		--muted-foreground: #646670; --border: #e4e5e9; --input: #d4d6dc; --ring: #1961d2;
		--primary: #1961d2; --primary-hover: #1553b5; --primary-foreground: #ffffff;
		--accent: rgba(40, 42, 48, 0.05); --accent-pressed: rgba(40, 42, 48, 0.1);
		--destructive-text: #c33037; --destructive-soft: rgba(195, 48, 55, 0.1);
		--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
		--font-sans: "Noto Sans JP Variable", "Hiragino Sans", "Yu Gothic UI", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
		--font-mono: "JetBrains Mono Variable", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		--tracking-heading: -0.015em; --tracking-body: -0.005em;
		--m-control: 40px; --m-text-title-lg: 1.375rem; --m-text-title: 1rem;
		--m-text-body: 0.9375rem; --m-text-secondary: 0.875rem; --m-text-footnote: 0.75rem;
		--text-sm: 0.8125rem;
	}
	@media (prefers-color-scheme: dark) {
		:root {
			color-scheme: dark;
			--background: #08090a; --foreground: #f7f8f8; --card: #141516;
			--muted-foreground: #9a9fa8; --border: #26282d; --input: #34363c; --ring: #5ea1f9;
			--primary: #4593f8; --primary-hover: #5ea1f9; --primary-foreground: #08090a;
			--accent: rgba(247, 248, 248, 0.06); --accent-pressed: rgba(247, 248, 248, 0.12);
			--destructive-text: #ff6b70; --destructive-soft: rgba(242, 85, 90, 0.18);
			--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.35);
		}
	}
	:where(*, *::before, *::after) { box-sizing: border-box; }
	body { margin: 0; min-height: 100svh; background: var(--background); color: var(--foreground);
		font-family: var(--font-sans); font-size: var(--m-text-secondary); letter-spacing: var(--tracking-body);
		-webkit-font-smoothing: antialiased; }
	main { margin: 0 auto; max-width: 440px; display: flex; flex-direction: column; gap: 20px;
		padding: 48px 14px 24px; }
	.head { display: flex; flex-direction: column; gap: 6px; }
	.brand { font-size: var(--m-text-title); font-weight: 600; letter-spacing: var(--tracking-heading); }
	h1 { margin: 0; font-size: var(--m-text-title-lg); font-weight: 600; line-height: 1.25;
		letter-spacing: var(--tracking-heading); }
	p { margin: 0; line-height: 1.5; }
	.lead { color: var(--muted-foreground); }
	.lead strong { color: var(--foreground); font-weight: 600; }
	ul { margin: 0; padding: 12px 14px 12px 32px; display: flex; flex-direction: column; gap: 4px;
		border: 1px solid var(--border); border-radius: 12px; background: var(--card);
		font-size: var(--m-text-body); line-height: 1.5; }
	.destination { font-size: var(--m-text-footnote); color: var(--muted-foreground); }
	.destination code { font-family: var(--font-mono); color: var(--foreground); }
	.alert { display: grid; grid-template-columns: auto 1fr; gap: 10px; padding: 12px 14px;
		border: 1px solid var(--border); border-radius: 8px; background: var(--destructive-soft);
		font-size: var(--text-sm); }
	.alert[hidden] { display: none; }
	.alert svg { width: 16px; height: 16px; margin-top: 1px; color: var(--destructive-text); }
	.alert-title { font-weight: 600; letter-spacing: var(--tracking-heading); }
	.alert-description { margin-top: 2px; color: var(--muted-foreground); }
	.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
	button { height: var(--m-control); padding: 0 18px; border: 1px solid transparent; border-radius: 8px;
		font: inherit; font-size: var(--m-text-body); font-weight: 500; letter-spacing: var(--tracking-body);
		cursor: pointer; outline: none; transition: background-color 100ms, border-color 100ms; }
	button:focus-visible { box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring); }
	button:disabled { opacity: 0.5; cursor: not-allowed; }
	#approve { background: var(--primary); color: var(--primary-foreground); }
	#approve:hover:not(:disabled) { background: var(--primary-hover); }
	#deny { background: var(--card); border-color: var(--input); color: var(--foreground);
		box-shadow: var(--shadow-sm); }
	#deny:hover:not(:disabled) { background-image: linear-gradient(var(--accent), var(--accent)); }
	#deny:active:not(:disabled) { background-image: linear-gradient(var(--accent-pressed), var(--accent-pressed)); }
	#deny:focus-visible { box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring); }
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
<div class="head">
<span class="brand">Sapphire 2</span>
<h1>Authorization request</h1>
<p class="lead"><strong>${clientName}</strong> is asking for access to your sapphire2 account. If you approve, it will be able to:</p>
</div>
<ul>${permissionItems}</ul>
${renderDestination(props.redirectHosts)}
<div class="alert" id="error" role="alert" hidden>
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M10 10l4 4m0 -4l-4 4"/></svg>
<div><p class="alert-title">Couldn't finish connecting</p><p class="alert-description">Close this page and try connecting again.</p></div>
</div>
<div class="actions">
<button id="deny" type="button">Deny</button>
<button id="approve" type="button">Approve</button>
</div>
</main>
<script type="application/json" id="consent-data">${scriptSafeJson({ code: props.code })}</script>
<script>${SCRIPT}</script>
</body>
</html>`;
}
