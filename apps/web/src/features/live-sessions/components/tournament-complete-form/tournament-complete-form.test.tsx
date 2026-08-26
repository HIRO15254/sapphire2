import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TournamentCompleteForm } from "./tournament-complete-form";

function renderWithSubmitButton(onSubmit: (values: unknown) => void = vi.fn()) {
	render(
		<>
			<TournamentCompleteForm formId="f" onSubmit={onSubmit} />
			<button form="f" type="submit">
				Submit
			</button>
		</>
	);
	return onSubmit;
}

describe("TournamentCompleteForm", () => {
	it("shows the placement/total-entries hint when beforeDeadline is off", () => {
		render(<TournamentCompleteForm formId="f" onSubmit={vi.fn()} />);
		expect(
			screen.getByText("Place must not exceed total entries.")
		).toBeInTheDocument();
	});

	it("shows the early-exit hint and hides placement/total-entries fields when beforeDeadline is on", async () => {
		const user = userEvent.setup();
		render(<TournamentCompleteForm formId="f" onSubmit={vi.fn()} />);
		await user.click(
			screen.getByLabelText("Completed before registration deadline")
		);
		expect(
			screen.getByText("Early exit does not record place or total entries.")
		).toBeInTheDocument();
		expect(screen.queryByLabelText("Placement *")).not.toBeInTheDocument();
		expect(
			screen.queryByText("Place must not exceed total entries.")
		).not.toBeInTheDocument();
	});

	it("rejects submission and shows an error when placement exceeds totalEntries", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		renderWithSubmitButton(onSubmit);
		await user.type(screen.getByLabelText("Placement *"), "51");
		await user.type(screen.getByLabelText("Total Entries *"), "50");
		await user.type(screen.getByLabelText("Prize Money *"), "0");
		await user.click(screen.getByRole("button", { name: "Submit" }));
		expect(onSubmit).not.toHaveBeenCalled();
		expect(
			screen.getByText("Placement must not exceed total entries")
		).toBeInTheDocument();
	});

	it("submits the full finished-tournament payload on valid input", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		renderWithSubmitButton(onSubmit);
		await user.type(screen.getByLabelText("Placement *"), "3");
		await user.type(screen.getByLabelText("Total Entries *"), "50");
		await user.type(screen.getByLabelText("Prize Money *"), "500");
		await user.type(screen.getByLabelText("Bounty Prizes"), "25");
		await user.click(screen.getByRole("button", { name: "Submit" }));
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenNthCalledWith(1, {
			beforeDeadline: false,
			placement: 3,
			totalEntries: 50,
			prizeMoney: 500,
			bountyPrizes: 25,
		});
	});
});
