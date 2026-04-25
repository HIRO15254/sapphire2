import { render } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { useSafeHtml } from "@/features/players/components/player-card/use-player-card";

function Probe({ html }: { html: string }) {
	const { ref } = useSafeHtml(html);
	return createElement("div", { "data-testid": "target", ref });
}

describe("useSafeHtml", () => {
	it("renders allowed tags unchanged (p, strong, em)", () => {
		const { getByTestId } = render(
			createElement(Probe, {
				html: "<p><strong>bold</strong> and <em>em</em></p>",
			})
		);
		expect(getByTestId("target").innerHTML).toBe(
			"<p><strong>bold</strong> and <em>em</em></p>"
		);
	});

	it("unwraps disallowed elements while keeping their text content", () => {
		const { getByTestId } = render(
			createElement(Probe, { html: "<div>inner</div>" })
		);
		expect(getByTestId("target").innerHTML).toBe("inner");
	});

	it("strips dangerous elements like <script> but preserves text nodes", () => {
		const { getByTestId } = render(
			createElement(Probe, {
				html: '<p>safe<script>alert("x")</script></p>',
			})
		);
		const html = getByTestId("target").innerHTML;
		expect(html).not.toContain("<script>");
		expect(html).toContain("safe");
	});

	it("removes disallowed attributes (style, onclick) from allowed tags", () => {
		const { getByTestId } = render(
			createElement(Probe, {
				html: '<p style="color:red" onclick="steal()">x</p>',
			})
		);
		const el = getByTestId("target").firstElementChild as Element;
		expect(el.tagName).toBe("P");
		expect(el.hasAttribute("style")).toBe(false);
		expect(el.hasAttribute("onclick")).toBe(false);
	});

	it("keeps href/rel/target on anchors", () => {
		const { getByTestId } = render(
			createElement(Probe, {
				html: '<p><a href="https://example.com" rel="noopener" target="_blank" data-evil="x">ok</a></p>',
			})
		);
		const anchor = getByTestId("target").querySelector(
			"a"
		) as HTMLAnchorElement;
		expect(anchor.getAttribute("href")).toBe("https://example.com");
		expect(anchor.getAttribute("rel")).toBe("noopener");
		expect(anchor.getAttribute("target")).toBe("_blank");
		expect(anchor.hasAttribute("data-evil")).toBe(false);
	});

	it("updates sanitized content when html prop changes", () => {
		const { getByTestId, rerender } = render(
			createElement(Probe, { html: "<p>one</p>" })
		);
		expect(getByTestId("target").innerHTML).toBe("<p>one</p>");
		rerender(createElement(Probe, { html: "<p>two</p>" }));
		expect(getByTestId("target").innerHTML).toBe("<p>two</p>");
	});
});
