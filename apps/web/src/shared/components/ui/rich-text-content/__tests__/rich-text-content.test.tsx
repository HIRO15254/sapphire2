import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichTextContent } from "@/shared/components/ui/rich-text-content";

function renderContent(html: string) {
	const { container } = render(<RichTextContent html={html} />);
	return container.firstChild as HTMLElement;
}

describe("RichTextContent", () => {
	it("renders allowed tags unchanged (p, strong, em)", () => {
		const el = renderContent("<p><strong>bold</strong> and <em>em</em></p>");
		expect(el.innerHTML).toBe("<p><strong>bold</strong> and <em>em</em></p>");
	});

	it("unwraps disallowed elements while keeping their text content", () => {
		const el = renderContent("<div>inner</div>");
		expect(el.innerHTML).toBe("inner");
	});

	it("strips dangerous elements like <script> but preserves text nodes", () => {
		const el = renderContent('<p>safe<script>alert("x")</script></p>');
		expect(el.innerHTML).not.toContain("<script>");
		expect(el.innerHTML).toContain("safe");
	});

	it("removes disallowed attributes (style, onclick) from allowed tags", () => {
		const el = renderContent('<p style="color:red" onclick="steal()">x</p>');
		const p = el.firstElementChild as Element;
		expect(p.tagName).toBe("P");
		expect(p.hasAttribute("style")).toBe(false);
		expect(p.hasAttribute("onclick")).toBe(false);
	});

	it("keeps href/rel/target on anchors and drops the rest", () => {
		const el = renderContent(
			'<p><a href="https://example.com" rel="noopener" target="_blank" data-evil="x">ok</a></p>'
		);
		const anchor = el.querySelector("a") as HTMLAnchorElement;
		expect(anchor.getAttribute("href")).toBe("https://example.com");
		expect(anchor.getAttribute("rel")).toBe("noopener");
		expect(anchor.getAttribute("target")).toBe("_blank");
		expect(anchor.hasAttribute("data-evil")).toBe(false);
	});

	it("updates sanitized content when the html prop changes", () => {
		const { container, rerender } = render(
			<RichTextContent html="<p>one</p>" />
		);
		const el = container.firstChild as HTMLElement;
		expect(el.innerHTML).toBe("<p>one</p>");
		rerender(<RichTextContent html="<p>two</p>" />);
		expect(el.innerHTML).toBe("<p>two</p>");
	});

	it("merges a custom className onto the prose container", () => {
		const { container } = render(
			<RichTextContent className="text-xs" html="<p>x</p>" />
		);
		const el = container.firstChild as HTMLElement;
		expect(el.className).toContain("text-xs");
		expect(el.className).toContain("prose");
	});
});
