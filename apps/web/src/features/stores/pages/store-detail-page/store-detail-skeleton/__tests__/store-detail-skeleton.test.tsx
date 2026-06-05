import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StoreDetailSkeleton } from "../store-detail-skeleton";

describe("StoreDetailSkeleton", () => {
	it("renders the labelled skeleton container", () => {
		render(<StoreDetailSkeleton />);
		expect(screen.getByTestId("store-detail-skeleton")).toBeInTheDocument();
	});

	it("renders skeleton placeholders for the header and game rows", () => {
		const { container } = render(<StoreDetailSkeleton />);
		const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
		// 2 top-bar + 2 title/memo + 1 tab strip + 3 rows × 3 = 14
		expect(skeletons.length).toBeGreaterThanOrEqual(10);
	});
});
