import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlayerListCardSkeleton } from "@/features/players/pages/players-page/player-list-card";

describe("PlayerListCardSkeleton", () => {
	it("mirrors the card surface (fixed-height bordered card row)", () => {
		const { container } = render(<PlayerListCardSkeleton />);
		const row = container.firstElementChild;
		expect(row).toHaveClass("h-16", "rounded-lg", "border", "bg-card");
	});

	it("renders animated placeholder bars for name, sub-line, and chevron", () => {
		const { container } = render(<PlayerListCardSkeleton />);
		const placeholders = container.querySelectorAll('[data-slot="skeleton"]');
		expect(placeholders).toHaveLength(3);
	});
});
