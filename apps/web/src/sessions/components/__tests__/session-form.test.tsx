import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionForm } from "../session-form";

const EV_HELPER_RE = /Expected value cash-out based on all-in equity/;
const BUY_IN_RE = /Buy-in/;
const SESSION_DATE_RE = /Session Date/;
const SESSION_TAG = { id: "series", name: "Series" };

describe("SessionForm", () => {
	it("renders cash game mode by default", () => {
		render(<SessionForm onSubmit={vi.fn()} />);

		expect(screen.getByText("Cash Game")).toBeInTheDocument();
		expect(screen.getByText("Tournament")).toBeInTheDocument();
		expect(document.getElementById("buyIn")).toBeInTheDocument();
		expect(document.getElementById("cashOut")).toBeInTheDocument();
	});

	it("renders EV Cash-out field in cash game mode", () => {
		render(<SessionForm onSubmit={vi.fn()} />);

		expect(screen.getByLabelText("EV Cash-out")).toBeInTheDocument();
		expect(screen.getByText(EV_HELPER_RE)).toBeInTheDocument();
	});

	it("switches to tournament mode and hides cash game fields", async () => {
		const user = userEvent.setup();
		render(<SessionForm onSubmit={vi.fn()} />);

		await user.click(screen.getByText("Tournament"));

		expect(document.getElementById("tournamentBuyIn")).toBeInTheDocument();
		expect(screen.queryByLabelText("EV Cash-out")).not.toBeInTheDocument();
	});

	it("does not show EV Cash-out in tournament mode", async () => {
		const user = userEvent.setup();
		render(<SessionForm onSubmit={vi.fn()} />);

		await user.click(screen.getByText("Tournament"));

		expect(screen.queryByLabelText("EV Cash-out")).not.toBeInTheDocument();
	});

	it("switches back to cash game mode", async () => {
		const user = userEvent.setup();
		render(<SessionForm onSubmit={vi.fn()} />);

		await user.click(screen.getByText("Tournament"));
		await user.click(screen.getByText("Cash Game"));

		expect(screen.getByLabelText(BUY_IN_RE)).toBeInTheDocument();
		expect(screen.getByLabelText("EV Cash-out")).toBeInTheDocument();
	});

	it("renders session date with today's date by default", () => {
		render(<SessionForm onSubmit={vi.fn()} />);

		const dateInput = screen.getByLabelText(SESSION_DATE_RE);
		expect(dateInput).toBeInTheDocument();
		expect((dateInput as HTMLInputElement).type).toBe("date");
	});

	it("renders start and end time fields", () => {
		render(<SessionForm onSubmit={vi.fn()} />);

		expect(screen.getByLabelText("Start Time")).toBeInTheDocument();
		expect(screen.getByLabelText("End Time")).toBeInTheDocument();
	});

	it("shows save button", () => {
		render(<SessionForm onSubmit={vi.fn()} />);

		expect(screen.getByText("Save")).toBeInTheDocument();
	});

	it("shows Saving... when loading", () => {
		render(<SessionForm isLoading onSubmit={vi.fn()} />);

		expect(screen.getByText("Saving...")).toBeInTheDocument();
	});

	it("uses default values when provided", () => {
		render(
			<SessionForm
				defaultValues={{
					type: "cash_game",
					buyIn: 5000,
					cashOut: 8000,
					evCashOut: 7000,
				}}
				onSubmit={vi.fn()}
			/>
		);

		const buyInInput = document.getElementById("buyIn") as HTMLInputElement;
		const cashOutInput = document.getElementById("cashOut") as HTMLInputElement;
		const evInput = document.getElementById("evCashOut") as HTMLInputElement;
		expect(buyInInput.value).toBe("5000");
		expect(cashOutInput.value).toBe("8000");
		expect(evInput.value).toBe("7000");
	});

	it("submits selected tag ids in cash game mode", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(<SessionForm onSubmit={onSubmit} tags={[SESSION_TAG]} />);

		await user.click(screen.getByRole("button", { name: "Tags & Memo" }));
		await user.click(screen.getByLabelText("Search tags"));
		await user.click(screen.getByText("Series"));

		await user.type(document.getElementById("buyIn") as HTMLElement, "1000");
		await user.type(document.getElementById("cashOut") as HTMLElement, "2000");
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				tagIds: ["series"],
				type: "cash_game",
			})
		);
	});
});
