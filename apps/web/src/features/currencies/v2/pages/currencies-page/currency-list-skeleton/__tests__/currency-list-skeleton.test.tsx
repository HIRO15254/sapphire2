import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CurrencyListSkeleton } from "@/features/currencies/v2/pages/currencies-page/currency-list-skeleton";

function countSkeletonRows(): number {
	// Each placeholder row is a direct child of the wrapper.
	return screen.getByTestId("currency-list-skeleton").children.length;
}

describe("CurrencyListSkeleton", () => {
	it("renders five placeholder rows by default", () => {
		render(<CurrencyListSkeleton />);
		expect(countSkeletonRows()).toBe(5);
	});

	it("renders the requested number of placeholder rows", () => {
		render(<CurrencyListSkeleton count={3} />);
		expect(countSkeletonRows()).toBe(3);
	});

	it("renders no rows when count is 0", () => {
		render(<CurrencyListSkeleton count={0} />);
		expect(countSkeletonRows()).toBe(0);
	});

	it("renders animate-pulse skeleton placeholders inside each row", () => {
		render(<CurrencyListSkeleton count={1} />);
		const wrapper = screen.getByTestId("currency-list-skeleton");
		const skeletons = wrapper.querySelectorAll('[data-slot="skeleton"]');
		expect(skeletons.length).toBeGreaterThan(0);
	});
});
