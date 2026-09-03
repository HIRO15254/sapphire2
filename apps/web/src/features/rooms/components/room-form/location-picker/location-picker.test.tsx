import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
		isLinkValid: false,
		linkError: null,
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

	it("renders search, link and current-location tabs under the Location label", () => {
		renderPicker();
		expect(screen.getByText("Location").tagName).toBe("LABEL");
		expect(screen.getByRole("tab", { name: "Search" })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "URL" })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "Current" })).toBeInTheDocument();
	});

	it("forwards typed search text to setQuery and the Search button to handleSearch", () => {
		const setQuery = vi.fn();
		const handleSearch = vi.fn();
		renderPicker({ query: "casino", setQuery, handleSearch });
		fireEvent.change(screen.getByRole("textbox", { name: "Search a place" }), {
			target: { value: "casino x" },
		});
		expect(setQuery).toHaveBeenCalledTimes(1);
		expect(setQuery).toHaveBeenCalledWith("casino x");
		fireEvent.click(screen.getByRole("button", { name: SEARCH_RE }));
		expect(handleSearch).toHaveBeenCalledTimes(1);
	});

	it.each([
		["the query is blank", { query: "   " }],
		["a search is in flight", { query: "casino", isSearching: true }],
	])("disables the Search button while %s", (_label, overrides) => {
		renderPicker(overrides);
		expect(screen.getByRole("button", { name: SEARCH_RE })).toBeDisabled();
	});

	it("renders one button per result and picks it on click", () => {
		const pickResult = vi.fn();
		const result = {
			name: "Casino",
			address: "Tokyo",
			latitude: 35.6,
			longitude: 139.7,
		};
		renderPicker({
			query: "casino",
			results: [result, { ...result, name: "Poker room", latitude: 36 }],
			pickResult,
		});
		expect(screen.getAllByRole("listitem")).toHaveLength(2);
		fireEvent.click(screen.getByRole("button", { name: CASINO_RE }));
		expect(pickResult).toHaveBeenCalledTimes(1);
		expect(pickResult).toHaveBeenCalledWith(result);
	});

	it("resolves a Google Maps link from the URL tab", async () => {
		const user = userEvent.setup();
		const setLink = vi.fn();
		const handleResolveLink = vi.fn();
		renderPicker({
			link: "https://maps.app.goo.gl/x",
			isLinkValid: true,
			setLink,
			handleResolveLink,
		});
		await user.click(screen.getByRole("tab", { name: "URL" }));
		fireEvent.change(screen.getByRole("textbox", { name: "Google Maps URL" }), {
			target: { value: "https://maps.app.goo.gl/y" },
		});
		expect(setLink).toHaveBeenCalledTimes(1);
		expect(setLink).toHaveBeenCalledWith("https://maps.app.goo.gl/y");
		await user.click(screen.getByRole("button", { name: "Set" }));
		expect(handleResolveLink).toHaveBeenCalledTimes(1);
	});

	it("requests the device position from the Current tab", async () => {
		const user = userEvent.setup();
		const captureLocation = vi.fn();
		renderPicker({ captureLocation });
		await user.click(screen.getByRole("tab", { name: "Current" }));
		await user.click(
			screen.getByRole("button", { name: "Use current location" })
		);
		expect(captureLocation).toHaveBeenCalledTimes(1);
	});

	it.each([
		["Search", { searchError: "Search failed" }, "Search failed"],
		[
			"URL",
			{ linkError: "Enter a valid Google Maps URL" },
			"Enter a valid Google Maps URL",
		],
		["Current", { gpsStatus: "denied" }, "Location permission denied"],
	])("surfaces the hook's message on the %s tab", async (tab, overrides, message) => {
		const user = userEvent.setup();
		renderPicker(overrides);
		await user.click(screen.getByRole("tab", { name: tab }));
		expect(screen.getByText(message)).toBeInTheDocument();
	});

	it("shows the confirmation link and clear button only when a location is set", () => {
		const clearLocation = vi.fn();
		const { rerender } = renderPicker({ hasLocation: false });
		expect(screen.queryByText(LOCATION_SET_RE)).not.toBeInTheDocument();

		hookState.current = baseState({ hasLocation: true, clearLocation });
		rerender(
			<LocationPicker
				latitude={35.6812}
				longitude={139.7671}
				onCoordsChange={vi.fn()}
			/>
		);
		expect(screen.getByText(LOCATION_SET_RE)).toHaveTextContent(
			"Location set: 35.68120, 139.76710"
		);
		expect(screen.getByRole("link", { name: MAPS_RE })).toHaveAttribute(
			"href",
			"https://www.google.com/maps/search/?api=1&query=35.6812,139.7671"
		);
		fireEvent.click(screen.getByRole("button", { name: CLEAR_RE }));
		expect(clearLocation).toHaveBeenCalledTimes(1);
	});
});
