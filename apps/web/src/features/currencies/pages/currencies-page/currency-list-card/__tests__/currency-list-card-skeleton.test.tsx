import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CurrencyListCardSkeleton } from "@/features/currencies/pages/currencies-page/currency-list-card/currency-list-card-skeleton";

describe("CurrencyListCardSkeleton", () => {
	it("renders a card-shaped row with the card's border/background surface", () => {
		const { container } = render(<CurrencyListCardSkeleton />);
		const row = container.firstElementChild;
		expect(row).not.toBeNull();
		expect(row?.className).toContain("border-border");
		expect(row?.className).toContain("bg-card");
	});

	it("renders exactly four skeleton placeholders (star · name · balance · chevron)", () => {
		const { container } = render(<CurrencyListCardSkeleton />);
		const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
		expect(skeletons).toHaveLength(4);
	});

	it("renders the placeholders in card order: a fixed star, a flexible name, then trailing fixed cells", () => {
		const { container } = render(<CurrencyListCardSkeleton />);
		const skeletons = Array.from(
			container.querySelectorAll('[data-slot="skeleton"]')
		);
		expect(skeletons[0]?.className).toContain("size-4");
		expect(skeletons[1]?.className).toContain("flex-1");
		expect(skeletons[2]?.className).toContain("w-16");
		expect(skeletons[2]?.className).toContain("shrink-0");
		expect(skeletons[3]?.className).toContain("size-3.5");
	});
});
