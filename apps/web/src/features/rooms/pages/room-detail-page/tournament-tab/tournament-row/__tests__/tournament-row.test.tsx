import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Tournament } from "@/features/rooms/hooks/use-tournaments";
import { TournamentRow } from "../tournament-row";

function makeTournament(overrides: Partial<Tournament> = {}): Tournament {
	return {
		id: "t1",
		name: "Main Event",
		variant: "NLH",
		variantId: null,
		roomId: "room-1",
		buyIn: 100,
		entryFee: 10,
		startingStack: 10_000,
		bountyAmount: null,
		tableSize: 9,
		currencyId: null,
		memo: null,
		archivedAt: null,
		blindLevelCount: 0,
		chipPurchases: [],
		tags: [],
		createdAt: "2026-01-01",
		updatedAt: "2026-01-01",
		...overrides,
	};
}

describe("TournamentRow", () => {
	it("renders the legacy nlh variant text through variantLabel as NLH", () => {
		render(
			<TournamentRow
				currencies={[]}
				onOpenActions={vi.fn()}
				tournament={makeTournament({ variant: "nlh" })}
			/>
		);
		expect(screen.getByText("NLH")).toBeInTheDocument();
	});

	it("renders a user-defined variant name verbatim (no uppercasing)", () => {
		render(
			<TournamentRow
				currencies={[]}
				onOpenActions={vi.fn()}
				tournament={makeTournament({ variant: "plo" })}
			/>
		);
		expect(screen.getByText("plo")).toBeInTheDocument();
		expect(screen.queryByText("PLO")).not.toBeInTheDocument();
	});

	it("calls onOpenActions with the tournament when the overflow button is clicked", async () => {
		const user = userEvent.setup();
		const onOpenActions = vi.fn();
		const tournament = makeTournament({ name: "Sunday Major" });
		render(
			<TournamentRow
				currencies={[]}
				onOpenActions={onOpenActions}
				tournament={tournament}
			/>
		);
		await user.click(
			screen.getByRole("button", { name: "Actions for Sunday Major" })
		);
		expect(onOpenActions).toHaveBeenCalledTimes(1);
		expect(onOpenActions).toHaveBeenNthCalledWith(1, tournament);
	});
});
