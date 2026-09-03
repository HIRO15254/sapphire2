import { render } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { useRichTextContent } from "@/shared/components/ui/rich-text-content/use-rich-text-content";

function Harness({ html }: { html: string }) {
	const { ref } = useRichTextContent(html);
	return createElement("div", { "data-testid": "target", ref });
}

function renderHtml(html: string) {
	const { getByTestId, rerender } = render(createElement(Harness, { html }));
	return {
		div: getByTestId("target"),
		setHtml: (nextHtml: string) =>
			rerender(createElement(Harness, { html: nextHtml })),
	};
}

describe("useRichTextContent", () => {
	it("writes allowed-tag html unchanged into the referenced element", () => {
		const { div } = renderHtml("<p><strong>bold</strong></p>");
		expect(div.innerHTML).toBe("<p><strong>bold</strong></p>");
	});

	it("unwraps a disallowed tag while keeping its children", () => {
		const { div } = renderHtml("<div>inner</div>");
		expect(div.innerHTML).toBe("inner");
	});

	it("strips non-href attributes from an anchor but keeps href/rel/target", () => {
		const { div } = renderHtml(
			'<a href="https://example.com" rel="noopener" target="_blank" data-evil="x">ok</a>'
		);
		const anchor = div.querySelector("a") as HTMLAnchorElement;
		expect(anchor.getAttribute("href")).toBe("https://example.com");
		expect(anchor.getAttribute("rel")).toBe("noopener");
		expect(anchor.getAttribute("target")).toBe("_blank");
		expect(anchor.hasAttribute("data-evil")).toBe(false);
	});

	it("strips attributes from a non-anchor allowed tag", () => {
		const { div } = renderHtml('<p style="color:red" onclick="x()">x</p>');
		const p = div.querySelector("p") as HTMLElement;
		expect(p.hasAttribute("style")).toBe(false);
		expect(p.hasAttribute("onclick")).toBe(false);
	});

	it("re-sanitizes into the same element when html changes", () => {
		const { div, setHtml } = renderHtml("<p>one</p>");
		expect(div.innerHTML).toBe("<p>one</p>");
		setHtml("<div>two</div>");
		expect(div.innerHTML).toBe("two");
	});
});
