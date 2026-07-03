import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const hookState = vi.hoisted(() => ({
	current: {} as Record<string, unknown>,
}));

vi.mock("./use-location-picker", () => ({
	useLocationPicker: () => hookState.current,
}));

import { LocationPicker } from "./location-picker";

const SEARCH_RE = /search/i;
const CASINO_RE = /casino/i;
const CLEAR_RE = /clear/i;
const MAPS_RE = /view on google maps/i;
const LOCATION_SET_RE = /location set:/i;

function baseState(overrides: Record<string, unknown> = {}) {
	return {
		query: "",
		setQuery: vi.fn(),
		link: "",
		setLink: vi.fn(),
		handleSearch: vi.fn(),
		results: [] as Array<{
			name: string;
			address: string;
			latitude: number;
			longitude: number;
		}>,
		isSearching: false,
		searchError: null,
		pickResult: vi.fn(),
		handleResolveLink: vi.fn(),
		isResolving: false,
		resolveError: null,
		captureLocation: vi.fn(),
		gpsStatus: "idle",
		clearLocation: vi.fn(),
		hasLocation: false,
		...overrides,
	};
}

function renderPicker(
	overrides: Record<string, unknown> = {},
	props: { latitude?: number | null; longitude?: number | null } = {}
) {
	hookState.current = baseState(overrides);
	return render(
		<LocationPicker
			latitude={props.latitude ?? null}
			longitude={props.longitude ?? null}
			onCoordsChange={vi.fn()}
		/>
	);
}

describe("LocationPicker", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("renders search, link and current-location tabs", () => {
		renderPicker();
		expect(screen.getByRole("tab", { name: "Search" })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "Link" })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "Current" })).toBeInTheDocument();
	});

	it("triggers handleSearch from the search button", () => {
		const handleSearch = vi.fn();
		renderPicker({ query: "casino", handleSearch });
		fireEvent.click(screen.getByRole("button", { name: SEARCH_RE }));
		expect(handleSearch).toHaveBeenCalledTimes(1);
	});

	it("disables the search button when the query is blank", () => {
		renderPicker({ query: "   " });
		expect(screen.getByRole("button", { name: SEARCH_RE })).toBeDisabled();
	});

	it("picks a search result on click", () => {
		const pickResult = vi.fn();
		const result = {
			name: "Casino",
			address: "Tokyo",
			latitude: 35.6,
			longitude: 139.7,
		};
		renderPicker({ query: "casino", results: [result], pickResult });
		fireEvent.click(screen.getByRole("button", { name: CASINO_RE }));
		expect(pickResult).toHaveBeenCalledWith(result);
	});

	it("shows the confirmation link and clear button when a location is set", () => {
		const clearLocation = vi.fn();
		renderPicker(
			{ hasLocation: true, clearLocation },
			{ latitude: 35.6812, longitude: 139.7671 }
		);
		const link = screen.getByRole("link", { name: MAPS_RE });
		expect(link).toHaveAttribute(
			"href",
			"https://www.google.com/maps/search/?api=1&query=35.6812,139.7671"
		);
		fireEvent.click(screen.getByRole("button", { name: CLEAR_RE }));
		expect(clearLocation).toHaveBeenCalledTimes(1);
	});

	it("hides the confirmation when no location is set", () => {
		renderPicker({ hasLocation: false });
		expect(screen.queryByText(LOCATION_SET_RE)).not.toBeInTheDocument();
	});
});
