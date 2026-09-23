import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EndTournamentSheet } from "@/features/live-sessions/pages/live-session-page/sheets/end-tournament-sheet";

const PLACE_LABEL = /^Place/;
const TOTAL_ENTRIES_LABEL = /^Total entries/;
const PRIZE_LABEL = /^Prize/;
const BOUNTY_LABEL = /^Bounty won/;
const EARLY_EXIT_LABEL = /Early exit/;

function setup() {
	const onSubmit = vi.fn();
	render(
		<EndTournamentSheet
			isPending={false}
			onOpenChange={vi.fn()}
			onSubmit={onSubmit}
			open
		/>
	);
	return { onSubmit, user: userEvent.setup() };
}

describe("EndTournamentSheet", () => {
	it("records the finishing place with the prize and bounty", async () => {
		const { onSubmit, user } = setup();
		await user.type(screen.getByLabelText(PLACE_LABEL), "3");
		await user.type(screen.getByLabelText(TOTAL_ENTRIES_LABEL), "128");
		await user.clear(screen.getByLabelText(PRIZE_LABEL));
		await user.type(screen.getByLabelText(PRIZE_LABEL), "45000");
		await user.type(screen.getByLabelText(BOUNTY_LABEL), "2000");
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).toHaveBeenCalledWith({
			beforeDeadline: false,
			bountyPrizes: 2000,
			placement: 3,
			prizeMoney: 45_000,
			totalEntries: 128,
		});
	});

	it("drops place and total entries on an early exit", async () => {
		const { onSubmit, user } = setup();
		await user.click(screen.getByRole("switch", { name: EARLY_EXIT_LABEL }));

		expect(screen.queryByLabelText(PLACE_LABEL)).not.toBeInTheDocument();
		expect(
			screen.queryByLabelText(TOTAL_ENTRIES_LABEL)
		).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).toHaveBeenCalledWith({
			beforeDeadline: true,
			bountyPrizes: 0,
			prizeMoney: 0,
		});
	});
});
