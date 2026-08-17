import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoomDetailSkeleton } from "../room-detail-skeleton";

describe("RoomDetailSkeleton", () => {
	it("renders the labelled skeleton container", () => {
		render(<RoomDetailSkeleton />);
		expect(screen.getByTestId("room-detail-skeleton")).toBeInTheDocument();
	});

	it("renders skeleton placeholders for the header and game rows", () => {
		const { container } = render(<RoomDetailSkeleton />);
		const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
		expect(skeletons.length).toBeGreaterThanOrEqual(10);
	});
});
