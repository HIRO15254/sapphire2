import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import type {
	SeatEntry,
	SeatPlayer,
} from "@/features/live-sessions/components/active-session-scene/use-active-session-scene-state";

vi.mock("./empty-seat-editor", () => ({
	EmptySeatEditor: ({
		heroAvailable,
		onAddExisting,
		onAddNew,
		onAddTemporary,
		onSeatHero,
	}: {
		heroAvailable: boolean;
		onAddExisting: (id: string, name: string) => void;
		onAddNew: (values: { name: string }) => void;
		onAddTemporary: () => void;
		onSeatHero: () => void;
	}) => (
		<div data-hero-available={heroAvailable} data-testid="empty-editor">
			<button onClick={() => onAddExisting("p-9", "Nina")} type="button">
				seat-existing
			</button>
			<button onClick={() => onAddNew({ name: "New" })} type="button">
				seat-new
			</button>
			<button onClick={onAddTemporary} type="button">
				seat-temp
			</button>
			<button onClick={onSeatHero} type="button">
				seat-hero
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

import { SeatTable } from "@/features/live-sessions/components/active-session-scene/seat-table";

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

function setup(
	overrides: Partial<React.ComponentProps<typeof SeatTable>> = {}
) {
	const props: React.ComponentProps<typeof SeatTable> = {
		excludePlayerIds: [],
		heroAvailable: true,
		onRemovePlayer: vi.fn(),
		onScanPlayers: vi.fn(),
		onSeatExisting: vi.fn(),
		onSeatHero: vi.fn(),
		onSeatNew: vi.fn(),
		onSeatTemporary: vi.fn(),
		onUnseatHero: vi.fn(),
		seats: makeSeats(3),
		unseatedPlayers: [],
		...overrides,
	};
	render(<SeatTable {...props} />);
	return props;
}

describe("SeatTable", () => {
	it("renders the Players heading and the scan action", async () => {
		const user = userEvent.setup();
		const props = setup();
		expect(screen.getByText("Players")).toBeInTheDocument();
		await user.click(
			screen.getByRole("button", { name: "Seat from screenshot" })
		);
		expect(props.onScanPlayers).toHaveBeenCalledTimes(1);
	});

	it("keeps both drawers closed initially", () => {
		setup();
		expect(screen.queryByTestId("empty-editor")).not.toBeInTheDocument();
		expect(screen.queryByTestId("occupied-editor")).not.toBeInTheDocument();
	});

	it("tapping an empty seat opens the seating drawer for that seat", async () => {
		const user = userEvent.setup();
		setup();
		await user.click(screen.getByRole("button", { name: "Seat 2" }));
		expect(screen.getByText("Seat 2")).toBeInTheDocument();
		expect(screen.getByTestId("empty-editor")).toBeInTheDocument();
	});

	it("passes heroAvailable through to the seating drawer editor", async () => {
		const user = userEvent.setup();
		setup({ heroAvailable: false });
		await user.click(screen.getByRole("button", { name: "Seat 1" }));
		expect(screen.getByTestId("empty-editor")).toHaveAttribute(
			"data-hero-available",
			"false"
		);
	});

	it("seating an existing player delegates with the tapped seat and closes", async () => {
		const user = userEvent.setup();
		const props = setup();
		await user.click(screen.getByRole("button", { name: "Seat 3" }));
		await user.click(screen.getByRole("button", { name: "seat-existing" }));
		expect(props.onSeatExisting).toHaveBeenCalledTimes(1);
		expect(props.onSeatExisting).toHaveBeenNthCalledWith(1, 2, "p-9", "Nina");
		expect(screen.queryByTestId("empty-editor")).not.toBeInTheDocument();
	});

	it("creating a new player delegates with the tapped seat and closes", async () => {
		const user = userEvent.setup();
		const props = setup();
		await user.click(screen.getByRole("button", { name: "Seat 1" }));
		await user.click(screen.getByRole("button", { name: "seat-new" }));
		expect(props.onSeatNew).toHaveBeenCalledTimes(1);
		expect(props.onSeatNew).toHaveBeenNthCalledWith(1, 0, { name: "New" });
		expect(screen.queryByTestId("empty-editor")).not.toBeInTheDocument();
	});

	it("seating a temporary player delegates with the tapped seat and closes", async () => {
		const user = userEvent.setup();
		const props = setup();
		await user.click(screen.getByRole("button", { name: "Seat 2" }));
		await user.click(screen.getByRole("button", { name: "seat-temp" }));
		expect(props.onSeatTemporary).toHaveBeenCalledTimes(1);
		expect(props.onSeatTemporary).toHaveBeenNthCalledWith(1, 1);
		expect(screen.queryByTestId("empty-editor")).not.toBeInTheDocument();
	});

	it("claiming the hero seat delegates with the tapped seat and closes", async () => {
		const user = userEvent.setup();
		const props = setup();
		await user.click(screen.getByRole("button", { name: "Seat 2" }));
		await user.click(screen.getByRole("button", { name: "seat-hero" }));
		expect(props.onSeatHero).toHaveBeenCalledTimes(1);
		expect(props.onSeatHero).toHaveBeenNthCalledWith(1, 1);
		expect(screen.queryByTestId("empty-editor")).not.toBeInTheDocument();
	});

	it("tapping the hero seat unseats the hero without opening a drawer", async () => {
		const user = userEvent.setup();
		const seats = makeSeats(3);
		(seats[0] as SeatEntry).isHero = true;
		const props = setup({ heroAvailable: false, seats });
		await user.click(screen.getByRole("button", { name: "Seat 1: Hero" }));
		expect(props.onUnseatHero).toHaveBeenCalledTimes(1);
		expect(screen.queryByTestId("empty-editor")).not.toBeInTheDocument();
		expect(screen.queryByTestId("occupied-editor")).not.toBeInTheDocument();
	});

	it("tapping an occupied seat opens the edit drawer for that player", async () => {
		const user = userEvent.setup();
		const seats = makeSeats(3);
		(seats[1] as SeatEntry).player = makePlayer({ seatPosition: 1 });
		setup({ seats });
		await user.click(screen.getByRole("button", { name: "Seat 2: Alice" }));
		expect(screen.getByTestId("occupied-editor")).toHaveTextContent(
			"editing:p-1"
		);
	});

	it("unseating from the edit drawer removes the player and closes", async () => {
		const user = userEvent.setup();
		const seats = makeSeats(3);
		(seats[1] as SeatEntry).player = makePlayer({
			playerId: "p-5",
			seatPosition: 1,
		});
		const props = setup({ seats });
		await user.click(screen.getByRole("button", { name: "Seat 2: Alice" }));
		await user.click(screen.getByRole("button", { name: "Unseat Alice" }));
		expect(props.onRemovePlayer).toHaveBeenCalledTimes(1);
		expect(props.onRemovePlayer).toHaveBeenNthCalledWith(1, "p-5");
		expect(screen.queryByTestId("occupied-editor")).not.toBeInTheDocument();
	});

	it("renders no unseated section when everyone is seated", () => {
		setup({ unseatedPlayers: [] });
		expect(screen.queryByText("Unseated")).not.toBeInTheDocument();
	});

	it("lists unseated players with their tags", () => {
		setup({
			unseatedPlayers: [
				makePlayer({
					id: "tp-8",
					name: "Bob",
					playerId: "p-8",
					seatPosition: null,
					tags: [
						{ color: "#fff", id: "tag-1", name: "Reg" },
						{ color: "#000", id: "tag-2", name: "Fish" },
					],
				}),
			],
		});
		expect(screen.getByText("Unseated")).toBeInTheDocument();
		expect(screen.getByText("Bob")).toBeInTheDocument();
		expect(screen.getByText("Reg")).toBeInTheDocument();
		expect(screen.getByText("Fish")).toBeInTheDocument();
	});

	it("tapping an unseated player opens the edit drawer", async () => {
		const user = userEvent.setup();
		setup({
			unseatedPlayers: [
				makePlayer({
					id: "tp-8",
					name: "Bob",
					playerId: "p-8",
					seatPosition: null,
				}),
			],
		});
		await user.click(screen.getByRole("button", { name: "Edit Bob" }));
		expect(screen.getByTestId("occupied-editor")).toHaveTextContent(
			"editing:p-8"
		);
	});

	it("the unseated row unseat action removes the player without a drawer", async () => {
		const user = userEvent.setup();
		const props = setup({
			unseatedPlayers: [
				makePlayer({
					id: "tp-8",
					name: "Bob",
					playerId: "p-8",
					seatPosition: null,
				}),
			],
		});
		await user.click(screen.getByRole("button", { name: "Unseat Bob" }));
		expect(props.onRemovePlayer).toHaveBeenCalledTimes(1);
		expect(props.onRemovePlayer).toHaveBeenNthCalledWith(1, "p-8");
		expect(screen.queryByTestId("occupied-editor")).not.toBeInTheDocument();
	});

	it("forwards gameInfo to the table center", () => {
		setup({ gameInfo: { blinds: "100-200", name: "NLH" } });
		expect(screen.getByText("NLH")).toBeInTheDocument();
		expect(screen.getByText("100-200")).toBeInTheDocument();
	});
});
