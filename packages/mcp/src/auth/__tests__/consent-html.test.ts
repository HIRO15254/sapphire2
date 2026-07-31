import { describe, expect, it } from "vitest";
import { renderConsentHtml } from "../consent-html";

const BASE_PROPS = {
	clientId: "client-1",
	clientName: "Claude",
	clientMetadata: null,
	code: "consent-code-123",
	scopes: ["openid", "profile"],
};

describe("renderConsentHtml", () => {
	it("renders the client name and every requested scope", () => {
		const html = renderConsentHtml(BASE_PROPS);
		expect(html).toContain("Claude");
		expect(html).toContain("openid");
		expect(html).toContain("profile");
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

	it("escapes malicious scope values", () => {
		const html = renderConsentHtml({
			...BASE_PROPS,
			scopes: ["<img src=x onerror=alert(1)>"],
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

	it("never renders untrusted client metadata or icon URLs", () => {
		const html = renderConsentHtml({
			...BASE_PROPS,
			clientIcon: "https://evil.example/icon.png",
			clientMetadata: { note: "<script>meta</script>" },
		});
		expect(html).not.toContain("evil.example");
		expect(html).not.toContain("<script>meta</script>");
	});

	it("keeps the UI copy in English", () => {
		const html = renderConsentHtml(BASE_PROPS);
		expect(html).toContain("wants to access your sapphire2 data");
		expect(html).toContain("Approve");
		expect(html).toContain("Deny");
	});
});
