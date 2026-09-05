import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TournamentCompleteForm } from "./tournament-complete-form";

const PLACEMENT_LABEL = /^Placement/;
const ENTRIES_LABEL = /^Total Entries/;
const PRIZE_LABEL = /^Prize Money/;

function renderForm() {
	const onSubmit = vi.fn();
	render(
		<>
			<TournamentCompleteForm
				formId="complete-tournament"
				onSubmit={onSubmit}
			/>
			<button form="complete-tournament" type="submit">
				Complete tournament
			</button>
		</>
	);
	return { onSubmit, user: userEvent.setup() };
}

describe("TournamentCompleteForm", () => {
	it("validates required fields and submits the entered results from the external toolbar", async () => {
		const { onSubmit, user } = renderForm();
		const placement = screen.getByRole("textbox", { name: PLACEMENT_LABEL });
		const entries = screen.getByRole("textbox", { name: ENTRIES_LABEL });
		const prize = screen.getByRole("textbox", { name: PRIZE_LABEL });
		expect(placement).toHaveAttribute("inputmode", "numeric");
		expect(prize).toHaveValue("0");
		await user.click(
			screen.getByRole("button", { name: "Complete tournament" })
		);
		await waitFor(() =>
			expect(placement).toHaveAccessibleDescription("Required")
		);
		expect(entries).toHaveAccessibleDescription("Required");
		expect(onSubmit).not.toHaveBeenCalled();
		await user.type(placement, "3");
		await user.type(entries, "50");
		await user.clear(prize);
		await user.type(prize, "500");
		await user.type(
			screen.getByRole("textbox", { name: "Bounty Prizes" }),
			"25"
		);
		await user.click(
			screen.getByRole("button", { name: "Complete tournament" })
		);
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith({
			beforeDeadline: false,
			placement: 3,
			totalEntries: 50,
			prizeMoney: 500,
			bountyPrizes: 25,
		});
	});

	it("omits placement before the deadline and requires it again when the option is cleared", async () => {
		const { onSubmit, user } = renderForm();
		const deadline = screen.getByRole("checkbox", {
			name: "Completed before registration deadline",
		});
		await user.click(deadline);
		expect(
			screen.queryByRole("textbox", { name: PLACEMENT_LABEL })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("textbox", { name: ENTRIES_LABEL })
		).not.toBeInTheDocument();
		await user.click(
			screen.getByRole("button", { name: "Complete tournament" })
		);
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith({
			beforeDeadline: true,
			prizeMoney: 0,
			bountyPrizes: 0,
		});
		await user.click(deadline);
		await user.click(
			screen.getByRole("button", { name: "Complete tournament" })
		);
		await waitFor(() =>
			expect(
				screen.getByRole("textbox", { name: PLACEMENT_LABEL })
			).toHaveAccessibleDescription("Required")
		);
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});
});
