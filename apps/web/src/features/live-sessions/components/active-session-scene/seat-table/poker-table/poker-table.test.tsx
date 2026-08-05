import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
	SeatEntry,
	SeatPlayer,
} from "@/features/live-sessions/components/active-session-scene/use-active-session-scene-state";
import { PokerTable } from "./poker-table";

const REGEX_SEAT_BUTTON = /^Seat \d+/;

function makePlayer(overrides: Partial<SeatPlayer> = {}): SeatPlayer {
	return {
		id: "tp-1",
		isLoading: false,
		isTemporary: false,
		memo: null,
		name: "Alice",
		playerId: "p-1",
		seatPosition: 0,
		tags: [],
		...overrides,
	};
}

function makeSeats(count: number): SeatEntry[] {
	return Array.from({ length: count }, (_, i) => ({
		isHero: false,
		player: null,
		seatPosition: i,
	}));
}

function setup(overrides: Partial<React.ComponentProps<typeof PokerTable>>) {
	const props: React.ComponentProps<typeof PokerTable> = {
		heroAvailable: false,
		onEmptySeatTap: vi.fn(),
		onHeroSeatTap: vi.fn(),
		onPlayerSeatTap: vi.fn(),
		seats: makeSeats(9),
		...overrides,
	};
	render(<PokerTable {...props} />);
	return props;
}

function seatButtons(): HTMLElement[] {
	return screen.getAllByRole("button", { name: REGEX_SEAT_BUTTON });
}

describe("PokerTable", () => {
	it.each([
		2, 3, 4, 5, 6, 7, 8, 9, 10,
	])("renders %i seat buttons for %i seats", (count) => {
		setup({ seats: makeSeats(count) });
		expect(seatButtons()).toHaveLength(count);
	});

	it("caps rendering at the fallback formation when the seat count has no layout", () => {
		setup({ seats: makeSeats(12) });
		expect(seatButtons()).toHaveLength(9);
	});

	it("renders no seat buttons for an empty seats array", () => {
		setup({ seats: [] });
		expect(
			screen.queryByRole("button", { name: REGEX_SEAT_BUTTON })
		).not.toBeInTheDocument();
	});

	it("invokes onEmptySeatTap with the tapped 0-based seat position", async () => {
		const user = userEvent.setup();
		const props = setup({ seats: makeSeats(4) });
		await user.click(screen.getByRole("button", { name: "Seat 3" }));
		expect(props.onEmptySeatTap).toHaveBeenCalledTimes(1);
		expect(props.onEmptySeatTap).toHaveBeenCalledWith(2);
		expect(props.onHeroSeatTap).not.toHaveBeenCalled();
		expect(props.onPlayerSeatTap).not.toHaveBeenCalled();
	});

	it("shows the Sit hint on empty seats while the hero seat is unclaimed", () => {
		setup({ heroAvailable: true, seats: makeSeats(3) });
		expect(screen.getAllByText("Sit")).toHaveLength(3);
	});

	it("shows no Sit hint once the hero seat is taken", () => {
		const seats = makeSeats(3);
		const heroSeat = seats[0] as SeatEntry;
		heroSeat.isHero = true;
		setup({ heroAvailable: false, seats });
		expect(screen.queryByText("Sit")).not.toBeInTheDocument();
	});

	it("renders the hero seat with a You label and routes taps to onHeroSeatTap", async () => {
		const user = userEvent.setup();
		const seats = makeSeats(4);
		(seats[1] as SeatEntry).isHero = true;
		const props = setup({ seats });
		expect(screen.getByText("You")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Seat 2: Hero" }));
		expect(props.onHeroSeatTap).toHaveBeenCalledTimes(1);
		expect(props.onEmptySeatTap).not.toHaveBeenCalled();
	});

	it("renders an occupied seat with the player name and initial", () => {
		const seats = makeSeats(3);
		(seats[1] as SeatEntry).player = makePlayer({ seatPosition: 1 });
		setup({ seats });
		expect(screen.getByText("Alice")).toBeInTheDocument();
		expect(screen.getByText("A")).toBeInTheDocument();
	});

	it("routes occupied-seat taps to onPlayerSeatTap with the player and position", async () => {
		const user = userEvent.setup();
		const seats = makeSeats(3);
		const player = makePlayer({ seatPosition: 2 });
		(seats[2] as SeatEntry).player = player;
		const props = setup({ seats });
		await user.click(screen.getByRole("button", { name: "Seat 3: Alice" }));
		expect(props.onPlayerSeatTap).toHaveBeenCalledTimes(1);
		expect(props.onPlayerSeatTap).toHaveBeenCalledWith(player, 2);
	});

	it("disables an occupied seat while its row is still loading", async () => {
		const user = userEvent.setup();
		const seats = makeSeats(3);
		(seats[0] as SeatEntry).player = makePlayer({ isLoading: true });
		const props = setup({ seats });
		const button = screen.getByRole("button", { name: "Seat 1: Alice" });
		expect(button).toBeDisabled();
		await user.click(button);
		expect(props.onPlayerSeatTap).not.toHaveBeenCalled();
	});

	it("renders the game info in the table center", () => {
		setup({
			gameInfo: {
				blinds: "100-200",
				buyInRange: "MIN 20k - MAX 100k",
				name: "NLH",
			},
		});
		expect(screen.getByText("NLH")).toBeInTheDocument();
		expect(screen.getByText("100-200")).toBeInTheDocument();
		expect(screen.getByText("MIN 20k - MAX 100k")).toBeInTheDocument();
		expect(screen.queryByText("TABLE")).not.toBeInTheDocument();
	});

	it("falls back to the TABLE placeholder without game info", () => {
		setup({});
		expect(screen.getByText("TABLE")).toBeInTheDocument();
	});

	it("falls back to the TABLE placeholder when game info has no name or blinds", () => {
		setup({
			gameInfo: { blinds: null, buyInRange: "MIN 1 - MAX 2", name: null },
		});
		expect(screen.getByText("TABLE")).toBeInTheDocument();
	});
});
