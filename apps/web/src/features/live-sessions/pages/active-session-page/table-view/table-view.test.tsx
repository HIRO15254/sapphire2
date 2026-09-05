import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { TableView } from "@/features/live-sessions/pages/active-session-page/table-view";

const SEAT_LABEL_PATTERN = /^Seat \d+ —/;
const EV_RESULT_PATTERN = /EV result/;

function setup(
	overrides: Partial<React.ComponentProps<typeof TableView>> = {}
) {
	const props: React.ComponentProps<typeof TableView> = {
		dimmed: false,
		heroSeatPosition: null,
		kind: "cash_game",
		onEmptySeatTap: vi.fn(),
		onPlayerSeatTap: vi.fn(),
		onScan: vi.fn(),
		seatCount: 6,
		seatedPlayers: [],
		stackText: "12,400",
		...overrides,
	};
	render(<TableView {...props} />);
	return props;
}

describe("TableView", () => {
	it("renders stack, delta, bb and ev result for a cash game", () => {
		setup({
			bbText: "24.8bb",
			deltaText: "+1,200",
			deltaTone: "positive",
			evText: "+320",
			kind: "cash_game",
			stackText: "12,400",
		});
		expect(screen.getByText("12,400")).toBeInTheDocument();
		expect(screen.getByText("+1,200")).toBeInTheDocument();
		expect(screen.getByText("24.8bb")).toBeInTheDocument();
		expect(screen.getByText("+320").parentElement).toHaveTextContent(
			"EV result +320"
		);
	});

	it("renders remain and average stack for a tournament, with no delta or ev", () => {
		setup({
			averageStackText: "91,429",
			kind: "tournament",
			remainText: "42/128",
			stackText: "30,000",
		});
		expect(screen.getByText("30,000")).toBeInTheDocument();
		expect(screen.getByText("42/128").parentElement).toHaveTextContent(
			"Left 42/128 · Avg 91,429"
		);
		expect(screen.getByText("91,429")).toBeInTheDocument();
		expect(screen.queryByText(EV_RESULT_PATTERN)).not.toBeInTheDocument();
	});

	it("does not render a delta or ev row for a tournament even when deltaText is supplied", () => {
		setup({
			deltaText: "+500",
			deltaTone: "positive",
			kind: "tournament",
		});
		expect(screen.queryByText("+500")).not.toBeInTheDocument();
	});

	it("renders bb text when supplied", () => {
		setup({ bbText: "24.8bb", kind: "cash_game" });
		expect(screen.getByText("24.8bb")).toBeInTheDocument();
	});

	it("hides bb text row content when bbText is undefined", () => {
		setup({ bbText: undefined, kind: "cash_game" });
		expect(screen.queryByText("24.8bb")).not.toBeInTheDocument();
	});

	it("renders bb text for a tournament alongside the left/avg line", () => {
		setup({
			averageStackText: "91,429",
			bbText: "48bb",
			kind: "tournament",
			remainText: "42/128",
		});
		expect(screen.getByText("48bb")).toBeInTheDocument();
		expect(screen.getByText("42/128").parentElement).toHaveTextContent(
			"Left 42/128 · Avg 91,429"
		);
	});

	it("colors a positive delta as success when deltaTone is omitted", () => {
		setup({ deltaText: "+1,200", kind: "cash_game" });
		expect(screen.getByText("+1,200")).toHaveClass("text-success");
	});

	it("colors a negative delta as destructive when deltaTone is negative", () => {
		setup({ deltaText: "-800", deltaTone: "negative", kind: "cash_game" });
		expect(screen.getByText("-800")).toHaveClass("text-destructive");
	});

	it("does not render the seated player's name as visible text", () => {
		setup({
			seatCount: 4,
			seatedPlayers: [{ playerId: "p1", playerName: "Alice", seatPosition: 0 }],
		});
		expect(screen.getByLabelText("Seat 1 — Alice")).toBeInTheDocument();
		expect(screen.queryByText("Alice")).not.toBeInTheDocument();
	});

	it("forwards a seated player's dotColor to the seat marker's tint variable", () => {
		setup({
			seatCount: 4,
			seatedPlayers: [
				{
					dotColor: "var(--warning)",
					playerId: "p1",
					playerName: "Alice",
					seatPosition: 0,
				},
			],
		});
		const seat = screen.getByLabelText("Seat 1 — Alice");
		expect(seat.style.getPropertyValue("--seat-dot-color")).toBe(
			"var(--warning)"
		);
	});

	it("falls back to the muted-foreground token when a seated player has no dotColor", () => {
		setup({
			seatCount: 4,
			seatedPlayers: [{ playerId: "p1", playerName: "Alice", seatPosition: 0 }],
		});
		const seat = screen.getByLabelText("Seat 1 — Alice");
		expect(seat.style.getPropertyValue("--seat-dot-color")).toBe(
			"var(--muted-foreground)"
		);
	});

	it("renders seatCount markers split into empty, player and hero variants", () => {
		setup({
			heroSeatPosition: 2,
			seatCount: 5,
			seatedPlayers: [
				{ playerId: "p1", playerName: "Alice", seatPosition: 0 },
				{ playerId: "p2", playerName: "Bob", seatPosition: 4 },
			],
		});
		expect(screen.getByLabelText("Seat 1 — Alice")).toBeInTheDocument();
		expect(screen.getByLabelText("Seat 2 — empty")).toBeInTheDocument();
		expect(screen.getByLabelText("Seat 3 — you")).toBeInTheDocument();
		expect(screen.getByLabelText("Seat 4 — empty")).toBeInTheDocument();
		expect(screen.getByLabelText("Seat 5 — Bob")).toBeInTheDocument();
		expect(screen.getAllByLabelText(SEAT_LABEL_PATTERN)).toHaveLength(5);
	});

	it("calls onPlayerSeatTap exactly once with the full seat object when a player seat is tapped", async () => {
		const user = userEvent.setup();
		const props = setup({
			seatCount: 4,
			seatedPlayers: [{ playerId: "p1", playerName: "Alice", seatPosition: 1 }],
		});
		await user.click(screen.getByLabelText("Seat 2 — Alice"));
		expect(props.onPlayerSeatTap).toHaveBeenCalledTimes(1);
		expect(props.onPlayerSeatTap).toHaveBeenNthCalledWith(1, {
			playerId: "p1",
			playerName: "Alice",
			seatPosition: 1,
		});
		expect(props.onEmptySeatTap).not.toHaveBeenCalled();
	});

	it("calls onEmptySeatTap exactly once with the tapped seat position", async () => {
		const user = userEvent.setup();
		const props = setup({ seatCount: 4, seatedPlayers: [] });
		await user.click(screen.getByLabelText("Seat 3 — empty"));
		expect(props.onEmptySeatTap).toHaveBeenCalledTimes(1);
		expect(props.onEmptySeatTap).toHaveBeenNthCalledWith(1, 2);
		expect(props.onPlayerSeatTap).not.toHaveBeenCalled();
	});

	it("renders the hero marker as a non-interactive element, not a button", () => {
		setup({ heroSeatPosition: 0, seatCount: 4 });
		const hero = screen.getByLabelText("Seat 1 — you");
		expect(hero.tagName).not.toBe("BUTTON");
		expect(
			screen.queryByRole("button", { name: "Seat 1 — you" })
		).not.toBeInTheDocument();
	});

	it("calls onScan exactly once when the scan button is tapped", async () => {
		const user = userEvent.setup();
		const props = setup({ dimmed: false });
		await user.click(
			screen.getByRole("button", { name: "Register seats from a photo" })
		);
		expect(props.onScan).toHaveBeenCalledTimes(1);
	});

	it("disables seat buttons and blocks taps when dimmed", async () => {
		const user = userEvent.setup();
		const props = setup({
			dimmed: true,
			seatCount: 3,
			seatedPlayers: [{ playerId: "p1", playerName: "Alice", seatPosition: 0 }],
		});
		const playerSeat = screen.getByLabelText("Seat 1 — Alice");
		const emptySeat = screen.getByLabelText("Seat 2 — empty");
		expect(playerSeat).toBeDisabled();
		expect(emptySeat).toBeDisabled();
		await user.click(playerSeat);
		await user.click(emptySeat);
		expect(props.onPlayerSeatTap).not.toHaveBeenCalled();
		expect(props.onEmptySeatTap).not.toHaveBeenCalled();
	});

	it("labels seats with 1-based numbering while seatPosition stays 0-based", () => {
		setup({
			heroSeatPosition: null,
			seatCount: 2,
			seatedPlayers: [{ playerId: "p1", playerName: "Carl", seatPosition: 0 }],
		});
		expect(screen.getByLabelText("Seat 1 — Carl")).toBeInTheDocument();
		expect(screen.getByLabelText("Seat 2 — empty")).toBeInTheDocument();
	});
});
