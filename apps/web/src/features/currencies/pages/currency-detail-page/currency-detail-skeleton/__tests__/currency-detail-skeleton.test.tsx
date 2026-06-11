import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CurrencyDetailSkeleton } from "@/features/currencies/pages/currency-detail-page/currency-detail-skeleton";

describe("CurrencyDetailSkeleton", () => {
	it("renders the skeleton scaffold", () => {
		render(<CurrencyDetailSkeleton />);
		expect(screen.getByTestId("currency-detail-skeleton")).toBeInTheDocument();
	});

	it("renders multiple animate-pulse skeleton placeholders", () => {
		render(<CurrencyDetailSkeleton />);
		const skeletons = screen
			.getByTestId("currency-detail-skeleton")
			.querySelectorAll('[data-slot="skeleton"]');
		// top bar (2) + title (1) + hero (2) + button (1) + header (1) + 4 rows×3
		expect(skeletons.length).toBe(19);
	});

	it("is hidden from assistive tech", () => {
		render(<CurrencyDetailSkeleton />);
		expect(screen.getByTestId("currency-detail-skeleton")).toHaveAttribute(
			"aria-hidden"
		);
	});
});
