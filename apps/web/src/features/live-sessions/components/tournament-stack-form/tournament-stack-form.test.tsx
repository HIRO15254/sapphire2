import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { TournamentStackForm } from "./tournament-stack-form";

beforeAll(() => {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});
});

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

vi.mock("@/features/live-sessions/hooks/use-session-form", () => ({
	useTournamentFormContext: () => ({
		setChipPurchaseCounts: vi.fn(),
		setRemainingPlayers: vi.fn(),
		setStackAmount: mocks.setStackAmount,
		setTotalEntries: vi.fn(),
		state: mocks.state,
	}),
}));

vi.mock("@/features/live-sessions/components/chip-purchase-sheet", () => ({
	ChipPurchaseSheet: ({
		onSubmit,
		open,
	}: {
		onSubmit: (value: { chips: number; cost: number; name: string }) => void;
		open: boolean;
	}) =>
		open ? (
			<button
				onClick={() => onSubmit({ chips: 10_000, cost: 5000, name: "Rebuy" })}
				type="button"
			>
				Mock Purchase
			</button>
		) : null,
}));

vi.mock("@/shared/components/ui/responsive-dialog", () => ({
	ResponsiveDialog: ({
		children,
		open,
		title,
	}: {
		children: ReactNode;
		open: boolean;
		title: string;
	}) =>
		open ? (
			<div>
				<h2>{title}</h2>
				{children}
			</div>
		) : null,
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
		expect(screen.getByText("Complete")).toBeInTheDocument();
		expect(screen.getByText("Memo")).toBeInTheDocument();
		expect(screen.getByText("Pause")).toBeInTheDocument();
	});

	it("renders chip purchase count fields when types provided", () => {
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

		expect(screen.getByLabelText("Rebuy count")).toBeInTheDocument();
		expect(screen.getByLabelText("Addon count")).toBeInTheDocument();
	});

	it("shows no chip purchase count fields when no types provided", () => {
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

		expect(screen.queryByLabelText("Rebuy count")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Addon count")).not.toBeInTheDocument();
	});

	it("renders remaining players and total entries fields by default", () => {
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

		expect(screen.getByLabelText("Remaining Players")).toBeInTheDocument();
		expect(screen.getByLabelText("Total Entries")).toBeInTheDocument();
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

	it("calls onComplete when Complete is clicked", async () => {
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

		await user.click(screen.getByText("Complete"));
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

	it("calls onPurchaseChips via chip purchase sheet", async () => {
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

		await user.click(screen.getByText("Chip Purchase"));
		await user.click(screen.getByText("Mock Purchase"));

		expect(onPurchaseChips).toHaveBeenCalledWith({
			chips: 10_000,
			cost: 5000,
			name: "Rebuy",
		});
	});

	it("submits form values on update", async () => {
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

		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ stackAmount: 8000 })
		);
	});
});
