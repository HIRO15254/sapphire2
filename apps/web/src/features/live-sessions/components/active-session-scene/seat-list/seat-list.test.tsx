import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import type {
	SeatEntry,
	SeatPlayer,
} from "@/features/live-sessions/components/active-session-scene/use-active-session-scene-state";

vi.mock("./empty-seat-editor", () => ({
	EmptySeatEditor: ({
		onAddExisting,
		onAddNew,
		onAddTemporary,
	}: {
		onAddExisting: (id: string, name: string) => void;
		onAddNew: (values: { name: string }) => void;
		onAddTemporary: () => void;
	}) => (
		<div data-testid="empty-editor">
			<button onClick={() => onAddExisting("p-9", "Nina")} type="button">
				seat-existing
			</button>
			<button onClick={() => onAddNew({ name: "New" })} type="button">
				seat-new
			</button>
			<button onClick={onAddTemporary} type="button">
				seat-temp
			</button>
		</div>
	),
}));

vi.mock("./occupied-seat-editor", () => ({
	OccupiedSeatEditor: ({
		onRemove,
		onSaved,
		playerId,
	}: {
		onRemove: () => void;
		onSaved: () => void;
		playerId: string;
	}) => (
		<div data-testid="occupied-editor">
			<span>editing:{playerId}</span>
			<button onClick={onSaved} type="button">
				save
			</button>
			<button onClick={onRemove} type="button">
				leave
			</button>
		</div>
	),
}));

import { SeatList } from "@/features/live-sessions/components/active-session-scene/seat-list";

const REGEX_SEAT_1 = /Seat 1/;
const REGEX_SEAT_2 = /Seat 2/;
const REGEX_SEAT_3 = /Seat 3/;
const REGEX_SEAT_N = /^Seat \d/;
const REGEX_UNSEATED = /Unseated/;

function makePlayer(overrides: Partial<SeatPlayer> = {}): SeatPlayer {
	return {
		id: "tp-1",
		isLoading: false,
		isTemporary: false,
		name: "Alice",
		playerId: "p-1",
		seatPosition: 0,
		tags: [],
		...overrides,
	};
}

function makeSeats(
	entries: Array<Partial<SeatEntry> & { seatPosition: number }>
): SeatEntry[] {
	return entries.map((e) => ({
		isHero: false,
		player: null,
		...e,
	}));
}

function setup(overrides: Partial<React.ComponentProps<typeof SeatList>> = {}) {
	const props: React.ComponentProps<typeof SeatList> = {
		availableTags: [],
		excludePlayerIds: [],
		onCreateTag: vi.fn(),
		onRemovePlayer: vi.fn(),
		onScanPlayers: vi.fn(),
		onSeatExisting: vi.fn(),
		onSeatNew: vi.fn(),
		onSeatTemporary: vi.fn(),
		seats: makeSeats([
			{ seatPosition: 0 },
			{ seatPosition: 1 },
			{ seatPosition: 2 },
		]),
		unseatedPlayers: [],
		...overrides,
	};
	render(<SeatList {...props} />);
	return props;
}

describe("SeatList", () => {
	it("renders one row per seat, labeled 1-based", () => {
		setup();
		expect(screen.getByText("Seat 1")).toBeInTheDocument();
		expect(screen.getByText("Seat 2")).toBeInTheDocument();
		expect(screen.getByText("Seat 3")).toBeInTheDocument();
	});

	it("shows occupied seats with the player name and empty seats as Empty", () => {
		setup({
			seats: makeSeats([
				{ seatPosition: 0, player: makePlayer() },
				{ seatPosition: 1 },
			]),
		});
		expect(screen.getByText("Alice")).toBeInTheDocument();
		expect(screen.getByText("Empty")).toBeInTheDocument();
	});

	it("renders the hero seat as 'You' and makes it non-expandable", () => {
		setup({
			seats: makeSeats([
				{ seatPosition: 0, isHero: true },
				{ seatPosition: 1 },
			]),
		});
		expect(screen.getByText("You")).toBeInTheDocument();
		// Only seat 2 is expandable; the hero row renders no button.
		const rows = screen.getAllByRole("button", { name: REGEX_SEAT_N });
		expect(rows).toHaveLength(1);
	});

	it("expands an empty seat inline and seats an existing player at that seat", async () => {
		const user = userEvent.setup();
		const props = setup({ seats: makeSeats([{ seatPosition: 2 }]) });
		expect(screen.queryByTestId("empty-editor")).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: REGEX_SEAT_3 }));
		expect(screen.getByTestId("empty-editor")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "seat-existing" }));
		expect(props.onSeatExisting).toHaveBeenCalledWith(2, "p-9", "Nina");
		// Collapses after seating.
		expect(screen.queryByTestId("empty-editor")).not.toBeInTheDocument();
	});

	it("seats a new player at the expanded seat", async () => {
		const user = userEvent.setup();
		const props = setup({ seats: makeSeats([{ seatPosition: 1 }]) });
		await user.click(screen.getByRole("button", { name: REGEX_SEAT_2 }));
		await user.click(screen.getByRole("button", { name: "seat-new" }));
		expect(props.onSeatNew).toHaveBeenCalledWith(1, { name: "New" });
	});

	it("seats a temporary player at the expanded seat", async () => {
		const user = userEvent.setup();
		const props = setup({ seats: makeSeats([{ seatPosition: 1 }]) });
		await user.click(screen.getByRole("button", { name: REGEX_SEAT_2 }));
		await user.click(screen.getByRole("button", { name: "seat-temp" }));
		expect(props.onSeatTemporary).toHaveBeenCalledWith(1);
	});

	it("expands an occupied seat to its editor and leaves the table", async () => {
		const user = userEvent.setup();
		const props = setup({
			seats: makeSeats([{ seatPosition: 0, player: makePlayer() }]),
		});
		await user.click(screen.getByRole("button", { name: REGEX_SEAT_1 }));
		expect(screen.getByText("editing:p-1")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "leave" }));
		expect(props.onRemovePlayer).toHaveBeenCalledWith("p-1");
		expect(screen.queryByTestId("occupied-editor")).not.toBeInTheDocument();
	});

	it("expanding one row collapses any other open row", async () => {
		const user = userEvent.setup();
		setup({
			seats: makeSeats([{ seatPosition: 0 }, { seatPosition: 1 }]),
		});
		await user.click(screen.getByRole("button", { name: REGEX_SEAT_1 }));
		expect(screen.getAllByTestId("empty-editor")).toHaveLength(1);
		await user.click(screen.getByRole("button", { name: REGEX_SEAT_2 }));
		expect(screen.getAllByTestId("empty-editor")).toHaveLength(1);
	});

	it("renders unseated players in their own group", async () => {
		const user = userEvent.setup();
		const props = setup({
			seats: makeSeats([{ seatPosition: 0 }]),
			unseatedPlayers: [
				makePlayer({
					id: "tp-x",
					name: "Zoe",
					playerId: "p-x",
					seatPosition: null,
				}),
			],
		});
		expect(screen.getByText("Unseated")).toBeInTheDocument();
		expect(screen.getByText("Zoe")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: REGEX_UNSEATED }));
		await user.click(screen.getByRole("button", { name: "leave" }));
		expect(props.onRemovePlayer).toHaveBeenCalledWith("p-x");
	});

	it("'Seat from screenshot' triggers onScanPlayers", async () => {
		const user = userEvent.setup();
		const props = setup();
		await user.click(
			screen.getByRole("button", { name: "Seat from screenshot" })
		);
		expect(props.onScanPlayers).toHaveBeenCalledTimes(1);
	});

	it("passes the expanded occupied player's id to its editor", async () => {
		const user = userEvent.setup();
		setup({
			seats: makeSeats([
				{ seatPosition: 0, player: makePlayer({ playerId: "p-77" }) },
			]),
		});
		await user.click(screen.getByRole("button", { name: REGEX_SEAT_1 }));
		const editor = screen.getByTestId("occupied-editor");
		expect(within(editor).getByText("editing:p-77")).toBeInTheDocument();
	});
});
