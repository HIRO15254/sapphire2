import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TournamentStackForm } from "../tournament-stack-form";

// Mock the tournament form context
vi.mock("@/hooks/use-session-form", () => ({
	useTournamentFormContext: () => ({
		state: {
			stackAmount: "",
			remainingPlayers: "",
			totalEntries: "",
			chipPurchases: [],
			chipPurchaseCounts: [],
		},
		setStackAmount: vi.fn(),
		setRemainingPlayers: vi.fn(),
		setTotalEntries: vi.fn(),
		setChipPurchaseCounts: vi.fn(),
		addChipPurchase: vi.fn(),
		removeChipPurchase: vi.fn(),
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
		render(
			<TournamentStackForm
				chipPurchaseTypes={CHIP_PURCHASE_TYPES}
				isLoading={false}
				onComplete={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		expect(screen.getByPlaceholderText("Stack")).toBeInTheDocument();
		expect(screen.getByPlaceholderText("Remaining")).toBeInTheDocument();
		expect(screen.getByPlaceholderText("Total Entries")).toBeInTheDocument();
		expect(screen.getByText("Update")).toBeInTheDocument();
		expect(screen.getByText("End")).toBeInTheDocument();
		expect(screen.getByText("+ Rebuy")).toBeInTheDocument();
		expect(screen.getByText("+ Addon")).toBeInTheDocument();
	});

	it("shows no chip purchase buttons when no types provided", () => {
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
		render(
			<TournamentStackForm isLoading onComplete={vi.fn()} onSubmit={vi.fn()} />
		);

		expect(screen.getByText("...")).toBeInTheDocument();
	});

	it("calls onComplete when End is clicked", async () => {
		const user = userEvent.setup();
		const onComplete = vi.fn();

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
});
