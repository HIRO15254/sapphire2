import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PokerTable, type TablePlayer } from "./poker-table";

vi.mock("@/features/players/components/player-avatar", () => ({
	PlayerAvatar: ({ isHero }: { isHero?: boolean }) => (
		<div data-hero={isHero ? "true" : "false"}>avatar</div>
	),
}));

function emptyHandlers() {
	return {
		onEmptySeatTap: vi.fn(),
		onHeroSeatTap: vi.fn(),
		onPlayerSeatTap: vi.fn(),
	};
}

function countSeatButtons(): number {
	// Empty seats render an IconPlus or IconUser inside a circle; the most
	// reliable structural anchor is the "+" icon for empty/non-hero seats.
	// To get a stable seat count we instead inspect every <button> rendered
	// inside the table — the seats are buttons placed absolutely.
	return screen.getAllByRole("button").length;
}

describe("PokerTable", () => {
	it("renders 9 seats by default when tableSize is not provided", () => {
		const handlers = emptyHandlers();
		render(
			<PokerTable
				heroSeatPosition={null}
				{...handlers}
				players={[]}
				waitingForHero={false}
			/>
		);

		expect(countSeatButtons()).toBe(9);
	});

	it("renders 9 seats when tableSize is null", () => {
		const handlers = emptyHandlers();
		render(
			<PokerTable
				heroSeatPosition={null}
				{...handlers}
				players={[]}
				tableSize={null}
				waitingForHero={false}
			/>
		);

		expect(countSeatButtons()).toBe(9);
	});

	it.each([
		2, 3, 4, 5, 6, 7, 8, 9, 10,
	])("renders %i seats when tableSize is %i", (size) => {
		const handlers = emptyHandlers();
		render(
			<PokerTable
				heroSeatPosition={null}
				{...handlers}
				players={[]}
				tableSize={size}
				waitingForHero={false}
			/>
		);

		expect(countSeatButtons()).toBe(size);
	});

	it("falls back to 9 seats when tableSize is out of range", () => {
		const handlers = emptyHandlers();
		render(
			<PokerTable
				heroSeatPosition={null}
				{...handlers}
				players={[]}
				tableSize={42}
				waitingForHero={false}
			/>
		);

		expect(countSeatButtons()).toBe(9);
	});

	it("invokes onEmptySeatTap with the tapped seat index", async () => {
		const user = userEvent.setup();
		const handlers = emptyHandlers();
		render(
			<PokerTable
				heroSeatPosition={null}
				{...handlers}
				players={[]}
				tableSize={4}
				waitingForHero={false}
			/>
		);

		const buttons = screen.getAllByRole("button");
		expect(buttons).toHaveLength(4);
		await user.click(buttons[2] as HTMLElement);

		expect(handlers.onEmptySeatTap).toHaveBeenCalledWith(2);
	});

	it("renders an occupied seat for an active player at a valid seat", () => {
		const handlers = emptyHandlers();
		const players: TablePlayer[] = [
			{
				id: "tp-1",
				isActive: true,
				player: { id: "p-1", isTemporary: false, name: "Alice" },
				seatPosition: 1,
			},
		];

		render(
			<PokerTable
				heroSeatPosition={null}
				{...handlers}
				players={players}
				tableSize={3}
				waitingForHero={false}
			/>
		);

		expect(screen.getByText("Alice")).toBeInTheDocument();
	});

	it("does not render players whose seatPosition is outside the table size", () => {
		const handlers = emptyHandlers();
		const players: TablePlayer[] = [
			{
				id: "tp-1",
				isActive: true,
				player: { id: "p-1", isTemporary: false, name: "Bob" },
				seatPosition: 8,
			},
		];

		render(
			<PokerTable
				heroSeatPosition={null}
				{...handlers}
				players={players}
				tableSize={4}
				waitingForHero={false}
			/>
		);

		expect(screen.queryByText("Bob")).not.toBeInTheDocument();
	});
});
