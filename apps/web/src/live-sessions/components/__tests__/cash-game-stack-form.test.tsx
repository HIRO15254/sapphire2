import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CashGameStackForm } from "../cash-game-stack-form";

const mocks = vi.hoisted(() => ({
	state: {
		allIns: [] as Array<{
			equity: number;
			id: number;
			potSize: number;
			trials: number;
			wins: number;
		}>,
		stackAmount: "",
	},
	setAllIns: vi.fn(),
	setStackAmount: vi.fn(),
}));

vi.mock("@/live-sessions/hooks/use-session-form", () => ({
	useStackFormContext: () => ({
		state: mocks.state,
		setAllIns: mocks.setAllIns,
		setStackAmount: mocks.setStackAmount,
	}),
}));

vi.mock("@/live-sessions/components/all-in-bottom-sheet", () => ({
	AllInBottomSheet: ({
		onSubmit,
		open,
	}: {
		onSubmit: (value: {
			equity: number;
			potSize: number;
			trials: number;
			wins: number;
		}) => void;
		open: boolean;
	}) =>
		open ? (
			<button
				onClick={() =>
					onSubmit({ equity: 40, potSize: 1200, trials: 2, wins: 1 })
				}
				type="button"
			>
				Mock Save All-in
			</button>
		) : null,
}));

vi.mock("@/live-sessions/components/addon-bottom-sheet", () => ({
	AddonBottomSheet: ({
		onSubmit,
		open,
	}: {
		onSubmit: (value: { amount: number }) => void;
		open: boolean;
	}) =>
		open ? (
			<button onClick={() => onSubmit({ amount: 300 })} type="button">
				Mock Save Addon
			</button>
		) : null,
}));

describe("CashGameStackForm", () => {
	it("renders stack field and primary actions", () => {
		mocks.state.stackAmount = "";
		mocks.state.allIns = [];

		render(
			<CashGameStackForm
				isLoading={false}
				onChipAdd={vi.fn()}
				onComplete={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		expect(screen.getByLabelText("Current Stack *")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "End" })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "+ All-in" })
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "+ Addon" })).toBeInTheDocument();
	});

	it("calls onComplete with the current stack", async () => {
		const user = userEvent.setup();
		const onComplete = vi.fn();
		mocks.state.stackAmount = "4200";
		mocks.state.allIns = [];

		render(
			<CashGameStackForm
				isLoading={false}
				onChipAdd={vi.fn()}
				onComplete={onComplete}
				onSubmit={vi.fn()}
			/>
		);

		await user.click(screen.getByRole("button", { name: "End" }));

		expect(onComplete).toHaveBeenCalledWith(4200);
	});

	it("submits the same payload shape on update", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		mocks.state.stackAmount = "5000";
		mocks.state.allIns = [
			{ equity: 25, id: 1, potSize: 1200, trials: 2, wins: 1 },
		];

		render(
			<CashGameStackForm
				isLoading={false}
				onChipAdd={vi.fn()}
				onComplete={vi.fn()}
				onSubmit={onSubmit}
			/>
		);

		await user.click(screen.getByRole("button", { name: "Update" }));

		expect(onSubmit).toHaveBeenCalledWith({
			allIns: [{ equity: 25, potSize: 1200, trials: 2, wins: 1 }],
			stackAmount: 5000,
		});
	});

	it("adds an addon and increments the stack through the shared flow", async () => {
		const user = userEvent.setup();
		const onChipAdd = vi.fn();
		mocks.state.stackAmount = "1000";
		mocks.state.allIns = [];

		render(
			<CashGameStackForm
				isLoading={false}
				onChipAdd={onChipAdd}
				onComplete={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		await user.click(screen.getByRole("button", { name: "+ Addon" }));
		await user.click(screen.getByRole("button", { name: "Mock Save Addon" }));

		expect(onChipAdd).toHaveBeenCalledWith(300);
		expect(mocks.setStackAmount).toHaveBeenCalledWith("1300");
	});
});
