import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CurrencyDetailSkeleton } from "@/features/currencies/pages/currency-detail-page/currency-detail-skeleton";

describe("CurrencyDetailSkeleton", () => {
	it("is hidden from assistive tech", () => {
		render(<CurrencyDetailSkeleton />);
		expect(screen.getByTestId("currency-detail-skeleton")).toHaveAttribute(
			"aria-hidden",
			"true"
		);
	});
});
