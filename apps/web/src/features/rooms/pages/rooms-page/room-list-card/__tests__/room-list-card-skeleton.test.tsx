import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoomListCardSkeleton } from "@/features/rooms/pages/rooms-page/room-list-card/room-list-card-skeleton";

describe("RoomListCardSkeleton", () => {
	it("renders a card-shaped row with the card's border/background surface", () => {
		const { container } = render(<RoomListCardSkeleton />);
		const row = container.firstElementChild;
		expect(row).not.toBeNull();
		// Mirrors the real RoomListCard row surface.
		expect(row?.className).toContain("border-border");
		expect(row?.className).toContain("bg-card");
	});

	it("renders five skeleton placeholders (name · memo · 2 counts · chevron)", () => {
		const { container } = render(<RoomListCardSkeleton />);
		const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
		expect(skeletons).toHaveLength(5);
	});

	it("renders the trailing count placeholders as fixed-width cells", () => {
		const { container } = render(<RoomListCardSkeleton />);
		const skeletons = Array.from(
			container.querySelectorAll('[data-slot="skeleton"]')
		);
		// Two count cells: fixed width, do not shrink.
		expect(skeletons[2]?.className).toContain("w-8");
		expect(skeletons[2]?.className).toContain("shrink-0");
		expect(skeletons[3]?.className).toContain("w-8");
		// Chevron: small square.
		expect(skeletons[4]?.className).toContain("size-3.5");
	});
});
