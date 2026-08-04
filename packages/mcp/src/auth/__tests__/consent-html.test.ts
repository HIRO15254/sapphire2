import { describe, expect, it } from "vitest";
import { TOOL_DEFINITIONS, toolAnnotations } from "../../tools/registry";
import { renderConsentHtml } from "../consent-html";

const BASE_PROPS = {
	clientId: "client-1",
	clientName: "Claude",
	code: "consent-code-123",
	redirectHosts: ["claude.ai"],
};

describe("renderConsentHtml", () => {
	it("renders the client name", () => {
		expect(renderConsentHtml(BASE_PROPS)).toContain("Claude");
	});

	it("describes the real capability of the token, not OAuth scopes", () => {
		const html = renderConsentHtml(BASE_PROPS);
		// Authorization ignores scopes (see buildMcpSession), so the screen must
		// not imply the grant is limited to what the client requested.
		expect(html).not.toContain("openid");
		expect(html).not.toContain("offline_access");
		expect(html).toContain("Read your poker sessions");
	});

	it("discloses write access while the catalogue contains mutation tools", () => {
		const hasWriteTool = TOOL_DEFINITIONS.some(
			(def) => !toolAnnotations(def).readOnlyHint
		);
		expect(hasWriteTool).toBe(true);
		expect(renderConsentHtml(BASE_PROPS)).toContain("Create and edit your");
	});

	it("discloses irreversible edits while the catalogue contains destructive tools", () => {
		const hasDestructiveTool = TOOL_DEFINITIONS.some(
			(def) => toolAnnotations(def).destructiveHint
		);
		expect(hasDestructiveTool).toBe(true);
		expect(renderConsentHtml(BASE_PROPS)).toContain("cannot be undone");
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

	it("renders a Japanese client name intact", () => {
		const html = renderConsentHtml({
			...BASE_PROPS,
			clientName: "クロード開発ツール",
		});
		expect(html).toContain("クロード開発ツール");
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

	it("posts the decision to the better-auth consent endpoint", () => {
		const html = renderConsentHtml(BASE_PROPS);
		expect(html).toContain("/api/auth/oauth2/consent");
		expect(html).toContain("accept: true");
		expect(html).toContain("accept: false");
		expect(html).toContain("redirectURI");
	});

	it("keeps the UI copy in English", () => {
		const html = renderConsentHtml(BASE_PROPS);
		expect(html).toContain("Authorization request");
		expect(html).toContain("Approve");
		expect(html).toContain("Deny");
	});
});
