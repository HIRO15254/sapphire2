import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TournamentStackForm } from "../tournament-stack-form";

const mocks = vi.hoisted(() => ({
	addChipPurchase: vi.fn(),
	removeChipPurchase: vi.fn(),
	setChipPurchaseCounts: vi.fn(),
	setRemainingPlayers: vi.fn(),
	setStackAmount: vi.fn(),
	setTotalEntries: vi.fn(),
	state: {
		chipPurchaseCounts: [] as Array<{
			chipsPerUnit: number;
			count: number;
			name: string;
		}>,
		chipPurchases: [] as Array<{
			chips: number;
			cost: number;
			id: number;
			name: string;
		}>,
		remainingPlayers: "",
		stackAmount: "",
		totalEntries: "",
	},
}));

vi.mock("@/hooks/use-session-form", () => ({
	useTournamentFormContext: () => ({
		addChipPurchase: mocks.addChipPurchase,
		removeChipPurchase: mocks.removeChipPurchase,
		setChipPurchaseCounts: mocks.setChipPurchaseCounts,
		setRemainingPlayers: mocks.setRemainingPlayers,
		setStackAmount: mocks.setStackAmount,
		setTotalEntries: mocks.setTotalEntries,
		state: mocks.state,
	}),
}));

// Mock ResponsiveDialog to render children without portal
vi.mock("@/components/ui/responsive-dialog", () => ({
	ResponsiveDialog: ({
		children,
		open,
	}: {
		children: React.ReactNode;
		open: boolean;
	}) => (open ? <div>{children}</div> : null),
}));

const CHIP_PURCHASE_TYPES = [
	{ name: "Rebuy", cost: 5000, chips: 10_000 },
	{ name: "Addon", cost: 3000, chips: 8000 },
];

describe("TournamentStackForm", () => {
	it("renders stack input and buttons", () => {
		mocks.state.stackAmount = "";
		mocks.state.remainingPlayers = "";
		mocks.state.totalEntries = "";
		mocks.state.chipPurchases = [];
		mocks.state.chipPurchaseCounts = [];

		render(
			<TournamentStackForm
				chipPurchaseTypes={CHIP_PURCHASE_TYPES}
				isLoading={false}
				onComplete={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		expect(screen.getByLabelText("Current Stack *")).toBeInTheDocument();
		expect(screen.getByLabelText("Remaining Players")).toBeInTheDocument();
		expect(screen.getByLabelText("Total Entries")).toBeInTheDocument();
		expect(screen.getByText("Update")).toBeInTheDocument();
		expect(screen.getByText("End")).toBeInTheDocument();
		expect(screen.getByText("+ Rebuy")).toBeInTheDocument();
		expect(screen.getByText("+ Addon")).toBeInTheDocument();
	});

	it("shows no chip purchase buttons when no types provided", () => {
		mocks.state.stackAmount = "";
		mocks.state.remainingPlayers = "";
		mocks.state.totalEntries = "";
		mocks.state.chipPurchases = [];
		mocks.state.chipPurchaseCounts = [];

		render(
			<TournamentStackForm
				isLoading={false}
				onComplete={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		expect(screen.queryByText("+ Chip Purchase")).not.toBeInTheDocument();
		expect(screen.queryByText("+ Rebuy")).not.toBeInTheDocument();
	});

	it("shows count inputs when chipPurchaseTypes provided", () => {
		mocks.state.stackAmount = "";
		mocks.state.remainingPlayers = "";
		mocks.state.totalEntries = "";
		mocks.state.chipPurchases = [];
		mocks.state.chipPurchaseCounts = [];

		render(
			<TournamentStackForm
				chipPurchaseTypes={CHIP_PURCHASE_TYPES}
				isLoading={false}
				onComplete={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		expect(screen.getByText("Rebuy count")).toBeInTheDocument();
		expect(screen.getByText("Addon count")).toBeInTheDocument();
	});

	it("shows loading state on Update button", () => {
		mocks.state.stackAmount = "";
		mocks.state.remainingPlayers = "";
		mocks.state.totalEntries = "";
		mocks.state.chipPurchases = [];
		mocks.state.chipPurchaseCounts = [];

		render(
			<TournamentStackForm isLoading onComplete={vi.fn()} onSubmit={vi.fn()} />
		);

		expect(screen.getByText("...")).toBeInTheDocument();
	});

	it("calls onComplete when End is clicked", async () => {
		const user = userEvent.setup();
		const onComplete = vi.fn();
		mocks.state.stackAmount = "";
		mocks.state.remainingPlayers = "";
		mocks.state.totalEntries = "";
		mocks.state.chipPurchases = [];
		mocks.state.chipPurchaseCounts = [];

		render(
			<TournamentStackForm
				isLoading={false}
				onComplete={onComplete}
				onSubmit={vi.fn()}
			/>
		);

		await user.click(screen.getByText("End"));
		expect(onComplete).toHaveBeenCalled();
	});

	it("increments the stack when a quick purchase button is used", async () => {
		const user = userEvent.setup();
		mocks.state.stackAmount = "1200";
		mocks.state.remainingPlayers = "";
		mocks.state.totalEntries = "";
		mocks.state.chipPurchases = [];
		mocks.state.chipPurchaseCounts = [];

		render(
			<TournamentStackForm
				chipPurchaseTypes={CHIP_PURCHASE_TYPES}
				isLoading={false}
				onComplete={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		await user.click(screen.getByText("+ Rebuy"));

		expect(mocks.addChipPurchase).toHaveBeenCalledWith({
			chips: 10_000,
			cost: 5000,
			name: "Rebuy",
		});
		expect(mocks.setStackAmount).toHaveBeenCalledWith("11200");
	});

	it("submits the same tournament payload shape on update", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		mocks.state.stackAmount = "8000";
		mocks.state.remainingPlayers = "12";
		mocks.state.totalEntries = "120";
		mocks.state.chipPurchases = [
			{ chips: 5000, cost: 1000, id: 1, name: "Rebuy" },
		];
		mocks.state.chipPurchaseCounts = [
			{ chipsPerUnit: 5000, count: 2, name: "Rebuy" },
		];

		render(
			<TournamentStackForm
				chipPurchaseTypes={CHIP_PURCHASE_TYPES}
				isLoading={false}
				onComplete={vi.fn()}
				onSubmit={onSubmit}
			/>
		);

		await user.click(screen.getByText("Update"));

		expect(onSubmit).toHaveBeenCalledWith({
			chipPurchaseCounts: [{ chipsPerUnit: 5000, count: 2, name: "Rebuy" }],
			chipPurchases: [{ chips: 5000, cost: 1000, name: "Rebuy" }],
			remainingPlayers: 12,
			stackAmount: 8000,
			totalEntries: 120,
		});
	});
});
