import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface PlayerOption {
	id: string;
	memo: string | null;
	name: string;
	tags: { color: string; id: string; name: string }[];
}

const mocks = vi.hoisted(() => ({
	players: [] as PlayerOption[],
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: () => ({ data: mocks.players }),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		player: {
			list: { queryOptions: () => ({ queryKey: ["player", "list"] }) },
		},
	},
}));

import { JoinSeatSheet } from "./join-seat-sheet";

function makeOption(overrides: Partial<PlayerOption> = {}): PlayerOption {
	return { id: "p-1", memo: null, name: "Alice", tags: [], ...overrides };
}

const SEARCH_PLAYERS_NAME = /search players/i;
const MY_SEAT_SWITCH_NAME = /this is my seat/i;
const SCAN_BUTTON_NAME = /register every seat from a photo/i;
const CLEAR_SEARCH_NAME = /clear search/i;

function renderSheet(
	overrides: Partial<Parameters<typeof JoinSeatSheet>[0]> = {}
) {
	const props = {
		excludePlayerIds: [],
		heroAvailable: true,
		onOpenChange: vi.fn(),
		onScan: vi.fn(),
		onSeatExisting: vi.fn(),
		onSeatHero: vi.fn(),
		onSeatNew: vi.fn(),
		onSeatTemporary: vi.fn(),
		open: true,
		seatPosition: 2,
		...overrides,
	};
	return { props, ...render(<JoinSeatSheet {...props} />) };
}

describe("JoinSeatSheet", () => {
	beforeEach(() => {
		mocks.players = [];
	});

	it("shows the 1-indexed seat label in the title", () => {
		renderSheet({ seatPosition: 2 });
		expect(
			screen.getByRole("heading", { name: "Sit in at S3" })
		).toBeInTheDocument();
	});

	it("shows matching players as the user types", async () => {
		mocks.players = [
			makeOption({ id: "p-1", name: "Alice" }),
			makeOption({ id: "p-2", name: "Bob" }),
		];
		const user = userEvent.setup();
		renderSheet();
		await user.type(
			screen.getByRole("searchbox", { name: SEARCH_PLAYERS_NAME }),
			"ali"
		);
		expect(screen.getByText("Alice")).toBeInTheDocument();
		expect(screen.queryByText("Bob")).not.toBeInTheDocument();
	});

	it("seats an existing player once and closes the sheet on row tap", async () => {
		mocks.players = [makeOption({ id: "p-1", name: "Alice" })];
		const user = userEvent.setup();
		const { props } = renderSheet({ seatPosition: 4 });
		await user.click(screen.getByText("Alice"));
		expect(props.onSeatExisting).toHaveBeenCalledTimes(1);
		expect(props.onSeatExisting).toHaveBeenNthCalledWith(1, 4, "p-1", "Alice");
		expect(props.onOpenChange).toHaveBeenCalledTimes(1);
		expect(props.onOpenChange).toHaveBeenNthCalledWith(1, false);
	});

	it("seats a temporary player once and closes the sheet when the create row is tapped", async () => {
		const user = userEvent.setup();
		const { props } = renderSheet({ seatPosition: 1 });
		await user.type(
			screen.getByRole("searchbox", { name: SEARCH_PLAYERS_NAME }),
			"Sunglasses"
		);
		await user.click(screen.getByText("Sunglasses"));
		expect(props.onSeatTemporary).toHaveBeenCalledTimes(1);
		expect(props.onSeatTemporary).toHaveBeenNthCalledWith(1, 1);
		expect(props.onOpenChange).toHaveBeenCalledTimes(1);
		expect(props.onOpenChange).toHaveBeenNthCalledWith(1, false);
	});

	it("hides the my-seat row when heroAvailable is false", () => {
		renderSheet({ heroAvailable: false });
		expect(screen.queryByText("This is my seat")).not.toBeInTheDocument();
	});

	it("shows the my-seat row when heroAvailable is true", () => {
		renderSheet({ heroAvailable: true });
		expect(screen.getByText("This is my seat")).toBeInTheDocument();
	});

	it("claims the hero seat once and closes the sheet when the my-seat switch is toggled on", async () => {
		const user = userEvent.setup();
		const { props } = renderSheet({ heroAvailable: true, seatPosition: 3 });
		await user.click(screen.getByRole("switch", { name: MY_SEAT_SWITCH_NAME }));
		expect(props.onSeatHero).toHaveBeenCalledTimes(1);
		expect(props.onSeatHero).toHaveBeenNthCalledWith(1, 3);
		expect(props.onOpenChange).toHaveBeenCalledTimes(1);
		expect(props.onOpenChange).toHaveBeenNthCalledWith(1, false);
	});

	it("fires onScan once and closes the sheet when the scan row is tapped", async () => {
		const user = userEvent.setup();
		const { props } = renderSheet();
		await user.click(screen.getByRole("button", { name: SCAN_BUTTON_NAME }));
		expect(props.onScan).toHaveBeenCalledTimes(1);
		expect(props.onOpenChange).toHaveBeenCalledTimes(1);
		expect(props.onOpenChange).toHaveBeenNthCalledWith(1, false);
	});

	it("clears the search text when the clear button is tapped", async () => {
		const user = userEvent.setup();
		renderSheet();
		const searchInput = screen.getByRole("searchbox", {
			name: SEARCH_PLAYERS_NAME,
		});
		await user.type(searchInput, "ali");
		await user.click(screen.getByRole("button", { name: CLEAR_SEARCH_NAME }));
		expect(searchInput).toHaveValue("");
	});
});
