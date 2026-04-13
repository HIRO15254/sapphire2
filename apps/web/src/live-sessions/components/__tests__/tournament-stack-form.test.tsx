import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TournamentStackForm } from "../tournament-stack-form";

const mocks = vi.hoisted(() => ({
	setStackAmount: vi.fn(),
	state: {
		chipPurchaseCounts: [] as Array<{
			chipsPerUnit: number;
			count: number;
			name: string;
		}>,
		remainingPlayers: "",
		stackAmount: "",
		totalEntries: "",
	},
}));

vi.mock("@/live-sessions/hooks/use-session-form", () => ({
	useTournamentFormContext: () => ({
		setChipPurchaseCounts: vi.fn(),
		setRemainingPlayers: vi.fn(),
		setStackAmount: mocks.setStackAmount,
		setTotalEntries: vi.fn(),
		state: mocks.state,
	}),
}));

const CHIP_PURCHASE_TYPES = [
	{ name: "Rebuy", cost: 5000, chips: 10_000 },
	{ name: "Addon", cost: 3000, chips: 8000 },
];

describe("TournamentStackForm", () => {
	it("renders stack input and action buttons", () => {
		mocks.state.stackAmount = "";

		render(
			<TournamentStackForm
				chipPurchaseTypes={CHIP_PURCHASE_TYPES}
				isLoading={false}
				onComplete={vi.fn()}
				onMemo={vi.fn()}
				onPause={vi.fn()}
				onPurchaseChips={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		expect(screen.getByLabelText("Current Stack *")).toBeInTheDocument();
		expect(screen.getByText("Update")).toBeInTheDocument();
		expect(screen.getByText("End")).toBeInTheDocument();
		expect(screen.getByText("+ Memo")).toBeInTheDocument();
		expect(screen.getByText("Pause")).toBeInTheDocument();
	});

	it("renders chip purchase quick action buttons when types provided", () => {
		mocks.state.stackAmount = "";

		render(
			<TournamentStackForm
				chipPurchaseTypes={CHIP_PURCHASE_TYPES}
				isLoading={false}
				onComplete={vi.fn()}
				onMemo={vi.fn()}
				onPause={vi.fn()}
				onPurchaseChips={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		expect(screen.getByText("+ Rebuy")).toBeInTheDocument();
		expect(screen.getByText("+ Addon")).toBeInTheDocument();
	});

	it("shows no chip purchase buttons when no types provided", () => {
		mocks.state.stackAmount = "";

		render(
			<TournamentStackForm
				isLoading={false}
				onComplete={vi.fn()}
				onMemo={vi.fn()}
				onPause={vi.fn()}
				onPurchaseChips={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		expect(screen.queryByText("+ Rebuy")).not.toBeInTheDocument();
		expect(screen.queryByText("+ Addon")).not.toBeInTheDocument();
	});

	it("does not render remaining players or total entries fields", () => {
		mocks.state.stackAmount = "";

		render(
			<TournamentStackForm
				chipPurchaseTypes={CHIP_PURCHASE_TYPES}
				isLoading={false}
				onComplete={vi.fn()}
				onMemo={vi.fn()}
				onPause={vi.fn()}
				onPurchaseChips={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		expect(
			screen.queryByLabelText("Remaining Players")
		).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Total Entries")).not.toBeInTheDocument();
	});

	it("shows loading state on Update button", () => {
		mocks.state.stackAmount = "";

		render(
			<TournamentStackForm
				isLoading
				onComplete={vi.fn()}
				onMemo={vi.fn()}
				onPause={vi.fn()}
				onPurchaseChips={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		expect(screen.getByText("...")).toBeInTheDocument();
	});

	it("calls onComplete when End is clicked", async () => {
		const user = userEvent.setup();
		const onComplete = vi.fn();
		mocks.state.stackAmount = "";

		render(
			<TournamentStackForm
				isLoading={false}
				onComplete={onComplete}
				onMemo={vi.fn()}
				onPause={vi.fn()}
				onPurchaseChips={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		await user.click(screen.getByText("End"));
		expect(onComplete).toHaveBeenCalled();
	});

	it("calls onPause when Pause is clicked", async () => {
		const user = userEvent.setup();
		const onPause = vi.fn();
		mocks.state.stackAmount = "";

		render(
			<TournamentStackForm
				isLoading={false}
				onComplete={vi.fn()}
				onMemo={vi.fn()}
				onPause={onPause}
				onPurchaseChips={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		await user.click(screen.getByText("Pause"));
		expect(onPause).toHaveBeenCalled();
	});

	it("calls onPurchaseChips and increments stack when a quick purchase button is used", async () => {
		const user = userEvent.setup();
		const onPurchaseChips = vi.fn();
		mocks.state.stackAmount = "1200";

		render(
			<TournamentStackForm
				chipPurchaseTypes={CHIP_PURCHASE_TYPES}
				isLoading={false}
				onComplete={vi.fn()}
				onMemo={vi.fn()}
				onPause={vi.fn()}
				onPurchaseChips={onPurchaseChips}
				onSubmit={vi.fn()}
			/>
		);

		await user.click(screen.getByText("+ Rebuy"));

		expect(onPurchaseChips).toHaveBeenCalledWith({
			chips: 10_000,
			cost: 5000,
			name: "Rebuy",
		});
		expect(mocks.setStackAmount).toHaveBeenCalledWith("11200");
	});

	it("submits only stackAmount on update", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		mocks.state.stackAmount = "8000";

		render(
			<TournamentStackForm
				chipPurchaseTypes={CHIP_PURCHASE_TYPES}
				isLoading={false}
				onComplete={vi.fn()}
				onMemo={vi.fn()}
				onPause={vi.fn()}
				onPurchaseChips={vi.fn()}
				onSubmit={onSubmit}
			/>
		);

		await user.click(screen.getByText("Update"));

		expect(onSubmit).toHaveBeenCalledWith({ stackAmount: 8000 });
	});
});
