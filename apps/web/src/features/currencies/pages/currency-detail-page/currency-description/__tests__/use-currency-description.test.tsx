import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	DESCRIPTION_COLLAPSED_MAX_PX,
	useCurrencyDescription,
} from "@/features/currencies/pages/currency-detail-page/currency-description/use-currency-description";

let mockScrollHeight = 0;
let originalDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
	originalDescriptor = Object.getOwnPropertyDescriptor(
		HTMLElement.prototype,
		"scrollHeight"
	);
	Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
		configurable: true,
		get() {
			return mockScrollHeight;
		},
	});
});

afterEach(() => {
	if (originalDescriptor) {
		Object.defineProperty(
			HTMLElement.prototype,
			"scrollHeight",
			originalDescriptor
		);
	}
});

let latest: ReturnType<typeof useCurrencyDescription>;

function Harness() {
	latest = useCurrencyDescription();
	return <div ref={latest.contentRef} />;
}

describe("useCurrencyDescription", () => {
	it("starts collapsed with maxHeight pinned to the collapsed cap", () => {
		mockScrollHeight = DESCRIPTION_COLLAPSED_MAX_PX + 200;
		render(<Harness />);
		expect(latest.isExpanded).toBe(false);
		expect(latest.maxHeight).toBe(DESCRIPTION_COLLAPSED_MAX_PX);
	});

	it.each([
		[DESCRIPTION_COLLAPSED_MAX_PX, false],
		[DESCRIPTION_COLLAPSED_MAX_PX + 1, true],
	])("sets isOverflowing to %s→%s at the collapsed-height boundary", (scrollHeight, expected) => {
		mockScrollHeight = scrollHeight;
		render(<Harness />);
		expect(latest.isOverflowing).toBe(expected);
	});

	it("toggle expands maxHeight to the measured content height, then collapses it back", () => {
		mockScrollHeight = DESCRIPTION_COLLAPSED_MAX_PX + 200;
		render(<Harness />);

		act(() => {
			latest.toggle();
		});
		expect(latest.isExpanded).toBe(true);
		expect(latest.maxHeight).toBe(DESCRIPTION_COLLAPSED_MAX_PX + 200);

		act(() => {
			latest.toggle();
		});
		expect(latest.isExpanded).toBe(false);
		expect(latest.maxHeight).toBe(DESCRIPTION_COLLAPSED_MAX_PX);
	});
});
