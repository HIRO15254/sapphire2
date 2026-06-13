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
	OccupiedSeatEditor: ({ playerId }: { playerId: string }) => (
		<div data-testid="occupied-editor">editing:{playerId}</div>
	),
}));

vi.mock("./player-tag-badges", () => ({
	PlayerTagBadges: ({ tags }: { tags: { id: string; name: string }[] }) => (
		<span>
			{tags.map((t) => (
				<span key={t.id}>{t.name}</span>
			))}
		</span>
	),
}));

import { SeatList } from "@/features/live-sessions/components/active-session-scene/seat-list";

const REGEX_SEAT_1 = /Seat 1/;
const REGEX_SEAT_2 = /Seat 2/;
const REGEX_SEAT_N = /^Seat \d/;
const REGEX_UNSEATED = /Unseated/;

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
		excludePlayerIds: [],
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

	it("shows occupied seats with the player name and empty seats with the inline seater", () => {
		setup({
			seats: makeSeats([
				{ seatPosition: 0, player: makePlayer() },
				{ seatPosition: 1 },
			]),
		});
		expect(screen.getByText("Alice")).toBeInTheDocument();
		// The empty seat renders its always-on seater inline (no "Empty"/expand).
		expect(screen.getByTestId("empty-editor")).toBeInTheDocument();
	});

	it("shows the memo excerpt on the row with zero taps", () => {
		setup({
			seats: makeSeats([
				{
					seatPosition: 0,
					player: makePlayer({ memo: "<p>calls <b>too much</b></p>" }),
				},
			]),
		});
		expect(screen.getByText("calls too much")).toBeInTheDocument();
	});

	it("shows tag badges on the row with zero taps", () => {
		setup({
			seats: makeSeats([
				{
					seatPosition: 0,
					player: makePlayer({
						tags: [{ color: "#f00", id: "t1", name: "Fish" }],
					}),
				},
			]),
		});
		expect(screen.getByText("Fish")).toBeInTheDocument();
	});

	it("unseats an occupied player with a single tap on the row action", async () => {
		const user = userEvent.setup();
		const props = setup({
			seats: makeSeats([{ seatPosition: 0, player: makePlayer() }]),
		});
		await user.click(screen.getByRole("button", { name: "Unseat Alice" }));
		expect(props.onRemovePlayer).toHaveBeenCalledTimes(1);
		expect(props.onRemovePlayer).toHaveBeenCalledWith("p-1");
	});

	it("renders the hero seat as 'You' with no expand button and no seater", () => {
		setup({
			seats: makeSeats([
				{ seatPosition: 0, isHero: true },
				{ seatPosition: 1, player: makePlayer() },
			]),
		});
		expect(screen.getByText("You")).toBeInTheDocument();
		// Only the occupied seat is an expandable button; the hero row is static.
		const rows = screen.getAllByRole("button", { name: REGEX_SEAT_N });
		expect(rows).toHaveLength(1);
		// The hero row has no inline seater and no unseat action.
		expect(
			screen.getByRole("button", { name: REGEX_SEAT_N })
		).toHaveTextContent("Seat 2");
	});

	it("seats an existing player at the empty seat with no expand step", async () => {
		const user = userEvent.setup();
		const props = setup({ seats: makeSeats([{ seatPosition: 2 }]) });
		// The inline seater is present immediately — no expansion needed.
		expect(screen.getByTestId("empty-editor")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "seat-existing" }));
		expect(props.onSeatExisting).toHaveBeenCalledWith(2, "p-9", "Nina");
	});

	it("seats a new player at the empty seat", async () => {
		const user = userEvent.setup();
		const props = setup({ seats: makeSeats([{ seatPosition: 1 }]) });
		await user.click(screen.getByRole("button", { name: "seat-new" }));
		expect(props.onSeatNew).toHaveBeenCalledWith(1, { name: "New" });
	});

	it("seats a temporary player at the empty seat", async () => {
		const user = userEvent.setup();
		const props = setup({ seats: makeSeats([{ seatPosition: 1 }]) });
		await user.click(screen.getByRole("button", { name: "seat-temp" }));
		expect(props.onSeatTemporary).toHaveBeenCalledWith(1);
	});

	it("expands an occupied seat to its inline editor", async () => {
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

	it("expanding one occupied row collapses any other open row", async () => {
		const user = userEvent.setup();
		setup({
			seats: makeSeats([
				{ seatPosition: 0, player: makePlayer({ playerId: "p-a" }) },
				{
					seatPosition: 1,
					player: makePlayer({ id: "tp-b", name: "Bob", playerId: "p-b" }),
				},
			]),
		});
		await user.click(screen.getByRole("button", { name: REGEX_SEAT_1 }));
		expect(screen.getAllByTestId("occupied-editor")).toHaveLength(1);
		await user.click(screen.getByRole("button", { name: REGEX_SEAT_2 }));
		expect(screen.getAllByTestId("occupied-editor")).toHaveLength(1);
		expect(screen.getByText("editing:p-b")).toBeInTheDocument();
	});

	it("renders unseated players with their own one-tap unseat action", async () => {
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
		await user.click(screen.getByRole("button", { name: "Unseat Zoe" }));
		expect(props.onRemovePlayer).toHaveBeenCalledWith("p-x");
	});

	it("expands an unseated player to its inline editor", async () => {
		const user = userEvent.setup();
		setup({
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
		await user.click(screen.getByRole("button", { name: REGEX_UNSEATED }));
		expect(screen.getByText("editing:p-x")).toBeInTheDocument();
	});

	it("'Seat from screenshot' triggers onScanPlayers", async () => {
		const user = userEvent.setup();
		const props = setup();
		await user.click(
			screen.getByRole("button", { name: "Seat from screenshot" })
		);
		expect(props.onScanPlayers).toHaveBeenCalledTimes(1);
	});
});
