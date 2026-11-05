import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { renderConsentHtml } from "../consent-html";

const CONSENT_SCRIPT = /<script nonce="test-nonce">([\s\S]*?)<\/script>/;

const BASE_PROPS = {
	clientName: "Claude",
	code: "consent-code-123",
	nonce: "test-nonce",
	redirectHosts: ["claude.ai"],
};

describe("renderConsentHtml", () => {
	it("renders the client name", () => {
		expect(renderConsentHtml(BASE_PROPS)).toContain("Claude");
	});

	it("describes the real capability of the token, not OAuth scopes", () => {
		const html = renderConsentHtml(BASE_PROPS);
		expect(html).not.toContain("openid");
		expect(html).not.toContain("offline_access");
		expect(html).toContain("Read your statistics");
	});

	it("shows the registered redirect host so a look-alike name is detectable", () => {
		const html = renderConsentHtml(BASE_PROPS);
		expect(html).toContain("claude.ai");
		expect(html).toContain("Anyone can register an application under any name");
	});

	it("lists every registered redirect host", () => {
		const html = renderConsentHtml({
			...BASE_PROPS,
			redirectHosts: ["claude.ai", "localhost:9999"],
		});
		expect(html).toContain("claude.ai");
		expect(html).toContain("localhost:9999");
	});

	it("warns instead of going quiet when no destination is known", () => {
		const html = renderConsentHtml({ ...BASE_PROPS, redirectHosts: [] });
		expect(html).toContain("did not register a recognizable destination");
	});

	it("escapes a script tag injected through the client name (DCR is open to anyone)", () => {
		const html = renderConsentHtml({
			...BASE_PROPS,
			clientName: '<script>alert("xss")</script>',
		});
		expect(html).not.toContain('<script>alert("xss")</script>');
		expect(html).toContain("&lt;script&gt;");
	});

	it("escapes attribute-breakout quotes in the client name", () => {
		const html = renderConsentHtml({
			...BASE_PROPS,
			clientName: '" onmouseover="steal()',
		});
		expect(html).not.toContain('" onmouseover="steal()');
		expect(html).toContain("&quot; onmouseover=&quot;steal()");
	});

	it("escapes a malicious redirect host", () => {
		const html = renderConsentHtml({
			...BASE_PROPS,
			redirectHosts: ["<img src=x onerror=alert(1)>"],
		});
		expect(html).not.toContain("<img src=x");
		expect(html).toContain("&lt;img src=x");
	});

	it("falls back to a placeholder for an empty client name", () => {
		const html = renderConsentHtml({ ...BASE_PROPS, clientName: "" });
		expect(html).toContain("Unknown application");
	});

	it("embeds the consent code as JSON with < escaped so </script> cannot break out", () => {
		const html = renderConsentHtml({
			...BASE_PROPS,
			code: "</script><script>alert(1)//",
		});
		expect(html).not.toContain("</script><script>alert(1)//");
		expect(html).toContain("\\u003c/script");
	});

	it("escapes the CSP nonce before inserting it into the script attribute", () => {
		const html = renderConsentHtml({
			...BASE_PROPS,
			nonce: 'x" onload="alert(1)',
		});
		expect(html).toContain('nonce="x&quot; onload=&quot;alert(1)"');
	});

	it("rejects unsafe consent redirects while allowing secure and native callbacks", async () => {
		const html = renderConsentHtml(BASE_PROPS);
		const script = html.match(CONSENT_SCRIPT)?.[1];
		expect(script).toBeDefined();
		const cases = [
			["javascript:alert(1)", false],
			["data:text/html,unsafe", false],
			["vbscript:msgbox(1)", false],
			["file:///tmp/x", false],
			["blob:https://example.com/id", false],
			["about:blank", false],
			["http://example.com/callback", false],
			["not a url", false],
			["https://example.com/callback", true],
			["https://example.com/callback?state=a,b", true],
			["http://localhost:1234/callback", true],
			["http://127.0.0.1:1234/callback", true],
			["http://[::1]:1234/callback", true],
			["cursor://callback", true],
		] as const;
		for (const [redirectURI, allowed] of cases) {
			const handlers: Record<string, () => Promise<void>> = {};
			const elements = {
				"consent-data": { textContent: JSON.stringify({ code: "code" }) },
				approve: {
					disabled: false,
					addEventListener: (_: string, fn: () => Promise<void>) => {
						handlers.approve = fn;
					},
				},
				deny: {
					disabled: false,
					addEventListener: (_: string, fn: () => Promise<void>) => {
						handlers.deny = fn;
					},
				},
				error: { hidden: true },
			};
			const location = { href: "" };
			runInNewContext(script as string, {
				document: {
					getElementById: (id: keyof typeof elements) => elements[id],
				},
				fetch: async () => ({ ok: true, json: async () => ({ redirectURI }) }),
				window: { location },
				URL,
			});
			await handlers.approve?.();
			expect(location.href).toBe(allowed ? redirectURI : "");
			expect(elements.error.hidden).toBe(allowed);
		}
	});
});
