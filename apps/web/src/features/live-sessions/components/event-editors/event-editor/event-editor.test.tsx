import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EventEditor } from "./event-editor";

const STACK_AMOUNT = /Stack Amount/;

function renderTournamentStackEditor() {
	const onSubmit = vi.fn();
	render(
		<EventEditor
			event={{
				id: "stack-history-1",
				eventType: "update_stack",
				occurredAt: "2026-04-10T11:00:00.000Z",
				payload: {
					stackAmount: 12_500,
					remainingPlayers: 12,
					totalEntries: 80,
					chipPurchaseCounts: [
						{ name: "Rebuy", count: 2, chipsPerUnit: 10_000 },
					],
				},
			}}
			isLoading={false}
			maxTime={null}
			minTime={null}
			onSubmit={onSubmit}
			onTimeUpdate={vi.fn()}
			sessionType="tournament"
		/>
	);
	return onSubmit;
}

describe("tournament stack history editing", () => {
	it("saves changed player counts while preserving the recorded stack and chip purchases", async () => {
		const user = userEvent.setup();
		const onSubmit = renderTournamentStackEditor();
		const remainingPlayers = screen.getByRole("textbox", {
			name: "Remaining Players",
		});
		const totalEntries = screen.getByRole("textbox", { name: "Total Entries" });

		expect(remainingPlayers).toHaveValue("12");
		expect(totalEntries).toHaveValue("80");
		expect(screen.getByRole("textbox", { name: STACK_AMOUNT })).toHaveValue(
			"12500"
		);

		await user.clear(remainingPlayers);
		await user.type(remainingPlayers, "9");
		await user.clear(totalEntries);
		await user.type(totalEntries, "84");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(onSubmit).toHaveBeenCalledWith(
			{
				stackAmount: 12_500,
				remainingPlayers: 9,
				totalEntries: 84,
				chipPurchaseCounts: [{ name: "Rebuy", count: 2, chipsPerUnit: 10_000 }],
			},
			Date.parse("2026-04-10T11:00:00.000Z") / 1000
		);
	});

	it("keeps edited player counts after rejecting a negative stack and saves them after correction", async () => {
		const user = userEvent.setup();
		const onSubmit = renderTournamentStackEditor();
		const stack = screen.getByRole("textbox", { name: STACK_AMOUNT });
		const remainingPlayers = screen.getByRole("textbox", {
			name: "Remaining Players",
		});

		await user.clear(remainingPlayers);
		await user.type(remainingPlayers, "10");
		await user.clear(stack);
		await user.type(stack, "-1");
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Must be at least 0"
		);
		expect(onSubmit).not.toHaveBeenCalled();
		expect(stack).toHaveValue("-1");
		expect(remainingPlayers).toHaveValue("10");
		expect(screen.getByRole("textbox", { name: "Total Entries" })).toHaveValue(
			"80"
		);

		await user.clear(stack);
		await user.type(stack, "0");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(onSubmit).toHaveBeenCalledWith(
			{
				stackAmount: 0,
				remainingPlayers: 10,
				totalEntries: 80,
				chipPurchaseCounts: [{ name: "Rebuy", count: 2, chipsPerUnit: 10_000 }],
			},
			Date.parse("2026-04-10T11:00:00.000Z") / 1000
		);
	});
});
