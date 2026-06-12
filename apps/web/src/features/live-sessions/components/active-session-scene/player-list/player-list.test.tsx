import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import {
	PlayerList,
	type PlayerListItem,
} from "@/features/live-sessions/components/active-session-scene/player-list";

const REGEX_SEAT_PREFIX = /^Seat /;
const REGEX_BOB = /Bob/;
const REGEX_ALICE = /Alice/;

function makeItem(overrides: Partial<PlayerListItem> = {}): PlayerListItem {
	return {
		id: "tp-1",
		isLoading: false,
		isTemporary: false,
		name: "Alice",
		playerId: "p-1",
		seatPosition: null,
		tags: [],
		...overrides,
	};
}

function setup(
	overrides: Partial<React.ComponentProps<typeof PlayerList>> = {}
) {
	const props: React.ComponentProps<typeof PlayerList> = {
		onAddPlayer: vi.fn(),
		onPlayerTap: vi.fn(),
		onScanPlayers: vi.fn(),
		players: [],
		...overrides,
	};
	render(<PlayerList {...props} />);
	return props;
}

describe("PlayerList", () => {
	it("shows the empty state when no players are seated", () => {
		setup();
		expect(screen.getByText("No players seated yet.")).toBeInTheDocument();
	});

	it("renders one row per player with their names", () => {
		setup({
			players: [
				makeItem(),
				makeItem({ id: "tp-2", name: "Bob", playerId: "p-2" }),
			],
		});
		expect(screen.getByText("Alice")).toBeInTheDocument();
		expect(screen.getByText("Bob")).toBeInTheDocument();
		expect(
			screen.queryByText("No players seated yet.")
		).not.toBeInTheDocument();
	});

	it("shows a 1-based seat badge when the player has a seat", () => {
		setup({ players: [makeItem({ seatPosition: 0 })] });
		expect(screen.getByText("Seat 1")).toBeInTheDocument();
	});

	it("shows no seat badge when seatPosition is null", () => {
		setup({ players: [makeItem({ seatPosition: null })] });
		expect(screen.queryByText(REGEX_SEAT_PREFIX)).not.toBeInTheDocument();
	});

	it("marks temporary players with a Temp badge", () => {
		setup({
			players: [
				makeItem({ isTemporary: true }),
				makeItem({ id: "tp-2", name: "Bob", playerId: "p-2" }),
			],
		});
		expect(screen.getAllByText("Temp")).toHaveLength(1);
	});

	it("renders the player's tag badges", () => {
		setup({
			players: [
				makeItem({
					tags: [
						{ color: "#ff0000", id: "t1", name: "Fish" },
						{ color: "#00ff00", id: "t2", name: "Reg" },
					],
				}),
			],
		});
		expect(screen.getByText("Fish")).toBeInTheDocument();
		expect(screen.getByText("Reg")).toBeInTheDocument();
	});

	it("tapping a row reports that player's playerId", async () => {
		const user = userEvent.setup();
		const props = setup({
			players: [
				makeItem(),
				makeItem({ id: "tp-2", name: "Bob", playerId: "p-2" }),
			],
		});
		await user.click(screen.getByRole("button", { name: REGEX_BOB }));
		expect(props.onPlayerTap).toHaveBeenCalledTimes(1);
		expect(props.onPlayerTap).toHaveBeenCalledWith("p-2");
	});

	it("disables a row while its optimistic write is in flight", () => {
		setup({ players: [makeItem({ isLoading: true })] });
		expect(screen.getByRole("button", { name: REGEX_ALICE })).toBeDisabled();
	});

	it("'Add player' invokes onAddPlayer once", async () => {
		const user = userEvent.setup();
		const props = setup();
		await user.click(screen.getByRole("button", { name: "Add player" }));
		expect(props.onAddPlayer).toHaveBeenCalledTimes(1);
	});

	it("'Seat from screenshot' invokes onScanPlayers once", async () => {
		const user = userEvent.setup();
		const props = setup();
		await user.click(
			screen.getByRole("button", { name: "Seat from screenshot" })
		);
		expect(props.onScanPlayers).toHaveBeenCalledTimes(1);
	});
});
