import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TournamentStackRecordEditor } from "../tournament-stack-record-editor";

const STACK_AMOUNT_LABEL_PATTERN = /stack amount/i;

vi.mock("@/components/live-tournament/chip-purchase-sheet", () => ({
	ChipPurchaseSheet: () => null,
}));

describe("TournamentStackRecordEditor", () => {
	it("blocks invalid times and preserves the tournament payload shape on save", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(
			<TournamentStackRecordEditor
				initialOccurredAt="2026-04-04T11:00:00"
				initialPayload={{
					chipPurchaseCounts: [{ chipsPerUnit: 5000, count: 2, name: "Rebuy" }],
					chipPurchases: [{ chips: 5000, cost: 1000, name: "Rebuy" }],
					remainingPlayers: 12,
					stackAmount: 8000,
					totalEntries: 120,
				}}
				isLoading={false}
				maxTime={new Date("2026-04-04T11:30:00")}
				minTime={new Date("2026-04-04T10:45:00")}
				onDelete={vi.fn()}
				onSubmit={onSubmit}
			/>
		);

		await user.clear(screen.getByLabelText("Time"));
		await user.type(screen.getByLabelText("Time"), "11:45");

		expect(screen.getByText("Must be before 11:30")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

		await user.clear(screen.getByLabelText("Time"));
		await user.type(screen.getByLabelText("Time"), "11:20");
		await user.clear(screen.getByLabelText(STACK_AMOUNT_LABEL_PATTERN));
		await user.type(screen.getByLabelText(STACK_AMOUNT_LABEL_PATTERN), "9000");
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).toHaveBeenCalledWith(
			{
				chipPurchaseCounts: [{ chipsPerUnit: 5000, count: 2, name: "Rebuy" }],
				chipPurchases: [{ chips: 5000, cost: 1000, name: "Rebuy" }],
				remainingPlayers: 12,
				stackAmount: 9000,
				totalEntries: 120,
			},
			Math.floor(new Date("2026-04-04T11:20:00").getTime() / 1000)
		);
	});
});
