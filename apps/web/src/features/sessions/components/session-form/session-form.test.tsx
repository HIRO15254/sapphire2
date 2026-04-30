import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionForm } from "./session-form";

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

	describe("isLiveLinked cash session", () => {
		const renderLiveLinkedCash = () =>
			render(
				<SessionForm
					defaultValues={{
						type: "cash_game",
						buyIn: 10_000,
						cashOut: 12_000,
						evCashOut: 11_500,
					}}
					isLiveLinked
					onSubmit={vi.fn()}
				/>
			);

		it("shows the live-linked informational banner", () => {
			renderLiveLinkedCash();
			expect(screen.getByTestId("live-linked-banner")).toBeInTheDocument();
		});

		it("hides the session type switcher", () => {
			renderLiveLinkedCash();
			expect(
				screen.queryByRole("tab", { name: "Cash Game" })
			).not.toBeInTheDocument();
			expect(
				screen.queryByRole("tab", { name: "Tournament" })
			).not.toBeInTheDocument();
		});

		it("hides the derived cash fields (buyIn, cashOut, evCashOut)", () => {
			renderLiveLinkedCash();
			expect(document.getElementById("buyIn")).not.toBeInTheDocument();
			expect(document.getElementById("cashOut")).not.toBeInTheDocument();
			expect(document.getElementById("evCashOut")).not.toBeInTheDocument();
		});

		it("hides session date / time / break inputs", () => {
			renderLiveLinkedCash();
			expect(screen.queryByLabelText(SESSION_DATE_RE)).not.toBeInTheDocument();
			expect(screen.queryByLabelText("Start Time")).not.toBeInTheDocument();
			expect(screen.queryByLabelText("End Time")).not.toBeInTheDocument();
			expect(
				screen.queryByLabelText("Break Time (min)")
			).not.toBeInTheDocument();
		});

		it("hides cash-game detail fields (variant, blinds, ante, table size)", async () => {
			const user = userEvent.setup();
			renderLiveLinkedCash();
			await user.click(screen.getByRole("button", { name: "Detail" }));
			expect(document.getElementById("blind1")).not.toBeInTheDocument();
			expect(document.getElementById("blind2")).not.toBeInTheDocument();
			expect(document.getElementById("blind3")).not.toBeInTheDocument();
			expect(document.getElementById("ante")).not.toBeInTheDocument();
			expect(document.getElementById("anteType")).not.toBeInTheDocument();
			expect(document.getElementById("tableSize")).not.toBeInTheDocument();
			expect(document.getElementById("variant")).not.toBeInTheDocument();
		});
	});

	describe("isLiveLinked tournament session", () => {
		const renderLiveLinkedTournament = () =>
			render(
				<SessionForm
					defaultValues={{
						type: "tournament",
						tournamentBuyIn: 10_000,
						entryFee: 1000,
						prizeMoney: 25_000,
						placement: 3,
						totalEntries: 50,
						rebuyCount: 1,
						rebuyCost: 5000,
						addonCost: 2000,
						bountyPrizes: 0,
					}}
					isLiveLinked
					onSubmit={vi.fn()}
				/>
			);

		it("shows the live-linked informational banner", () => {
			renderLiveLinkedTournament();
			expect(screen.getByTestId("live-linked-banner")).toBeInTheDocument();
		});

		it("hides primary tournament fields derived from events", () => {
			renderLiveLinkedTournament();
			expect(
				document.getElementById("tournamentBuyIn")
			).not.toBeInTheDocument();
			expect(document.getElementById("entryFee")).not.toBeInTheDocument();
			expect(document.getElementById("prizeMoney")).not.toBeInTheDocument();
			expect(document.getElementById("placement")).not.toBeInTheDocument();
			expect(document.getElementById("totalEntries")).not.toBeInTheDocument();
			expect(document.getElementById("beforeDeadline")).not.toBeInTheDocument();
		});

		it("hides legacy / event-derived detail fields (rebuy, addon, bounty)", async () => {
			const user = userEvent.setup();
			renderLiveLinkedTournament();
			await user.click(
				screen.getByRole("button", { name: "Tournament Details" })
			);
			expect(document.getElementById("rebuyCount")).not.toBeInTheDocument();
			expect(document.getElementById("rebuyCost")).not.toBeInTheDocument();
			expect(document.getElementById("addonCost")).not.toBeInTheDocument();
			expect(document.getElementById("bountyPrizes")).not.toBeInTheDocument();
		});
	});

	describe("isLiveLinked metadata fields remain editable", () => {
		it("keeps memo textarea enabled and tag input accessible", async () => {
			const user = userEvent.setup();
			render(
				<SessionForm
					defaultValues={{ type: "cash_game" }}
					isLiveLinked
					onSubmit={vi.fn()}
					tags={[SESSION_TAG]}
				/>
			);

			await user.click(screen.getByRole("button", { name: "Tags & Memo" }));
			expect(screen.getByLabelText("Memo")).not.toBeDisabled();
			expect(screen.getByLabelText("Search tags")).not.toBeDisabled();
		});
	});

	describe("non-live-linked (default) remains fully editable", () => {
		it("does not render the live-linked banner", () => {
			render(<SessionForm onSubmit={vi.fn()} />);
			expect(
				screen.queryByTestId("live-linked-banner")
			).not.toBeInTheDocument();
		});

		it("keeps derived fields enabled", () => {
			render(<SessionForm onSubmit={vi.fn()} />);
			expect(document.getElementById("buyIn")).not.toBeDisabled();
			expect(document.getElementById("cashOut")).not.toBeDisabled();
			expect(screen.getByLabelText(SESSION_DATE_RE)).not.toBeDisabled();
			expect(screen.getByRole("tab", { name: "Cash Game" })).not.toBeDisabled();
		});
	});

	it("disables the save button while isLoading", () => {
		render(<SessionForm isLoading onSubmit={vi.fn()} />);
		expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
	});

	it("tournament mode exposes tournamentBuyIn but not cash-game buyIn/cashOut", async () => {
		const user = userEvent.setup();
		render(<SessionForm onSubmit={vi.fn()} />);
		await user.click(screen.getByText("Tournament"));
		expect(document.getElementById("tournamentBuyIn")).toBeInTheDocument();
		expect(document.getElementById("buyIn")).not.toBeInTheDocument();
		expect(document.getElementById("cashOut")).not.toBeInTheDocument();
	});
});
