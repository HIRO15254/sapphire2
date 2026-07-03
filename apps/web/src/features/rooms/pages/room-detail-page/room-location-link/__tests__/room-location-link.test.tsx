import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoomLocationLink } from "@/features/rooms/pages/room-detail-page/room-location-link";

const MAPS_RE = /view on google maps/i;

describe("RoomLocationLink", () => {
	it("renders a Google Maps link with the coordinates as the query", () => {
		render(<RoomLocationLink latitude={35.6812} longitude={139.7671} />);
		const link = screen.getByRole("link", { name: MAPS_RE });
		expect(link).toHaveAttribute(
			"href",
			"https://www.google.com/maps/search/?api=1&query=35.6812,139.7671"
		);
		expect(link).toHaveAttribute("target", "_blank");
		expect(link).toHaveAttribute("rel", "noreferrer");
	});

	it("renders nothing when latitude is null", () => {
		const { container } = render(
			<RoomLocationLink latitude={null} longitude={139.7671} />
		);
		expect(container).toBeEmptyDOMElement();
	});

	it("renders nothing when longitude is undefined", () => {
		const { container } = render(
			<RoomLocationLink latitude={35.6812} longitude={undefined} />
		);
		expect(container).toBeEmptyDOMElement();
	});
});
