import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlayerDetailSkeleton } from "@/features/players/pages/player-detail-page/player-detail-skeleton";

describe("PlayerDetailSkeleton", () => {
	it("renders the skeleton container", () => {
		render(<PlayerDetailSkeleton />);
		expect(screen.getByTestId("player-detail-skeleton")).toBeInTheDocument();
	});

	it("renders animated placeholder bars", () => {
		const { container } = render(<PlayerDetailSkeleton />);
		const placeholders = container.querySelectorAll('[data-slot="skeleton"]');
		// top bar (2) + title (1) + tag row (2) + memo block (3)
		expect(placeholders).toHaveLength(8);
	});
});
