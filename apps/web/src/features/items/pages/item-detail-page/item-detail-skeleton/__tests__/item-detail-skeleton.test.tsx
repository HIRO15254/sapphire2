import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ItemDetailSkeleton } from "@/features/items/pages/item-detail-page/item-detail-skeleton";

describe("ItemDetailSkeleton", () => {
	it("renders the skeleton scaffold", () => {
		render(<ItemDetailSkeleton />);
		expect(screen.getByTestId("item-detail-skeleton")).toBeInTheDocument();
	});

	it("renders multiple animate-pulse skeleton placeholders", () => {
		render(<ItemDetailSkeleton />);
		const skeletons = screen
			.getByTestId("item-detail-skeleton")
			.querySelectorAll('[data-slot="skeleton"]');
		// top bar (2) + title (1) + hero (3) + button (1) + header (1) + 4 rows×3
		expect(skeletons.length).toBe(20);
	});

	it("is hidden from assistive tech", () => {
		render(<ItemDetailSkeleton />);
		expect(screen.getByTestId("item-detail-skeleton")).toHaveAttribute(
			"aria-hidden"
		);
	});
});
