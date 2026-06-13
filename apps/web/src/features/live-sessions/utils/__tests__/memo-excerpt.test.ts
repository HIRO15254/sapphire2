import { describe, expect, it } from "vitest";
import { memoExcerpt } from "@/features/live-sessions/utils/memo-excerpt";

describe("memoExcerpt", () => {
	it("returns null for null", () => {
		expect(memoExcerpt(null)).toBeNull();
	});

	it("returns null for an empty string", () => {
		expect(memoExcerpt("")).toBeNull();
	});

	it("returns plain text unchanged", () => {
		expect(memoExcerpt("loose preflop")).toBe("loose preflop");
	});

	it("strips HTML tags from rich-text memos", () => {
		expect(memoExcerpt("<p>calls <strong>too much</strong></p>")).toBe(
			"calls too much"
		);
	});

	it("joins block elements with a single space", () => {
		expect(memoExcerpt("<p>line one</p><p>line two</p>")).toBe(
			"line one line two"
		);
	});

	it("converts <br> into a space", () => {
		expect(memoExcerpt("a<br>b<br/>c")).toBe("a b c");
	});

	it("decodes common HTML entities", () => {
		expect(memoExcerpt("<p>3-bets &amp; folds &lt;50%&gt;</p>")).toBe(
			"3-bets & folds <50%>"
		);
	});

	it("collapses whitespace runs", () => {
		expect(memoExcerpt("<p>  a   \n  b </p>")).toBe("a b");
	});

	it("returns null when the markup contains no text", () => {
		expect(memoExcerpt("<p></p><p>  </p>")).toBeNull();
	});
});
