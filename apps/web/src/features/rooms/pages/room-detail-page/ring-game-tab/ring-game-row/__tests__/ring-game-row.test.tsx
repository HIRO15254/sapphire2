import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RingGame } from "@/features/rooms/hooks/use-ring-games";
import { RingGameRow } from "../ring-game-row";

function makeGame(overrides: Partial<RingGame> = {}): RingGame {
	return {
		id: "r1",
		name: "1/2",
		variant: "NLH",
		variantId: null,
		roomId: "room-1",
		blind1: 1,
		blind2: 2,
		blind3: null,
		ante: null,
		anteType: "none",
		tableSize: 9,
		minBuyIn: 40,
		maxBuyIn: 200,
		memo: null,
		currencyId: null,
		archivedAt: null,
		createdAt: "2026-01-01",
		updatedAt: "2026-01-01",
		userId: "user-1",
		...overrides,
	};
}

describe("RingGameRow", () => {
	it("renders the legacy NLH variant text through variantLabel as NLH", () => {
		render(
			<RingGameRow
				currencies={[]}
				game={makeGame({ variant: "nlh" })}
				onOpenActions={vi.fn()}
			/>
		);
		expect(screen.getByText("NLH")).toBeInTheDocument();
	});

	it("renders a user-defined variant name verbatim (no uppercasing)", () => {
		render(
			<RingGameRow
				currencies={[]}
				game={makeGame({ variant: "plo" })}
				onOpenActions={vi.fn()}
			/>
		);
		expect(screen.getByText("plo")).toBeInTheDocument();
		expect(screen.queryByText("PLO")).not.toBeInTheDocument();
	});

	it("calls onOpenActions with the game when the overflow button is clicked", async () => {
		const user = userEvent.setup();
		const onOpenActions = vi.fn();
		const game = makeGame({ name: "Deep Stack" });
		render(
			<RingGameRow currencies={[]} game={game} onOpenActions={onOpenActions} />
		);
		await user.click(
			screen.getByRole("button", { name: "Actions for Deep Stack" })
		);
		expect(onOpenActions).toHaveBeenCalledTimes(1);
		expect(onOpenActions).toHaveBeenNthCalledWith(1, game);
	});
});
