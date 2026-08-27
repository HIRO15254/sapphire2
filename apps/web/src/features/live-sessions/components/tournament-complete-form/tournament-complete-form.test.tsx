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
			screen.getByLabelText("Early exit (left before the result)")
		);
		expect(
			screen.getByText("Early exit does not record place or total entries.")
		).toBeInTheDocument();
		expect(screen.queryByLabelText("Place *")).not.toBeInTheDocument();
		expect(
			screen.queryByText("Place must not exceed total entries.")
		).not.toBeInTheDocument();
	});

	it("rejects submission and shows an error when placement exceeds totalEntries", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		renderWithSubmitButton(onSubmit);
		await user.type(screen.getByLabelText("Place *"), "51");
		await user.type(screen.getByLabelText("Total entries *"), "50");
		await user.type(screen.getByLabelText("Prize *"), "0");
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
		await user.type(screen.getByLabelText("Place *"), "3");
		await user.type(screen.getByLabelText("Total entries *"), "50");
		await user.type(screen.getByLabelText("Prize *"), "500");
		await user.type(screen.getByLabelText("Bounty won"), "25");
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

	it("renders the early-exit row with a warning-colored clock-off icon", () => {
		render(<TournamentCompleteForm formId="f" onSubmit={vi.fn()} />);
		const label = screen.getByText("Early exit (left before the result)");
		const icon = label.querySelector("svg");
		expect(icon).not.toBeNull();
		expect(icon?.getAttribute("class")).toContain("text-warning");
	});

	it("shows the trailing closing-record note", () => {
		render(<TournamentCompleteForm formId="f" onSubmit={vi.fn()} />);
		expect(
			screen.getByText(
				"You can edit this from history later. This closes the record."
			)
		).toBeInTheDocument();
	});
});
