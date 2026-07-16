import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ItemListCardSkeleton } from "@/features/items/pages/items-page/item-list-card/item-list-card-skeleton";

describe("ItemListCardSkeleton", () => {
	it("renders a card-shaped row with the card's border/background surface", () => {
		const { container } = render(<ItemListCardSkeleton />);
		const row = container.firstElementChild;
		expect(row).not.toBeNull();
		// Mirrors the real ItemListCard row surface.
		expect(row?.className).toContain("border-border");
		expect(row?.className).toContain("bg-card");
	});

	it("renders exactly four skeleton placeholders (name · meta · holdings · chevron)", () => {
		const { container } = render(<ItemListCardSkeleton />);
		const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
		expect(skeletons).toHaveLength(4);
	});

	it("renders the placeholders in card order: stacked name/meta lines, then trailing fixed cells", () => {
		const { container } = render(<ItemListCardSkeleton />);
		const skeletons = Array.from(
			container.querySelectorAll('[data-slot="skeleton"]')
		);
		// Name: first stacked line.
		expect(skeletons[0]?.className).toContain("h-4");
		expect(skeletons[0]?.className).toContain("w-2/5");
		// Meta: second stacked line.
		expect(skeletons[1]?.className).toContain("h-3");
		expect(skeletons[1]?.className).toContain("w-3/5");
		// Holdings: fixed width, does not shrink.
		expect(skeletons[2]?.className).toContain("w-16");
		expect(skeletons[2]?.className).toContain("shrink-0");
		// Chevron: small square, fixed.
		expect(skeletons[3]?.className).toContain("size-3.5");
	});
});
