import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CashGameStackForm } from "../cash-game-stack-form";

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
	state: {
		stackAmount: "",
	},
	setStackAmount: vi.fn(),
}));

vi.mock("@/live-sessions/hooks/use-session-form", () => ({
	useStackFormContext: () => ({
		state: mocks.state,
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

vi.mock("@/shared/components/ui/responsive-dialog", () => ({
	ResponsiveDialog: ({
		children,
		open,
		title,
	}: {
		children: React.ReactNode;
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

const defaultProps = {
	isLoading: false,
	onAllIn: vi.fn(),
	onChipAdd: vi.fn(),
	onChipRemove: vi.fn(),
	onComplete: vi.fn(),
	onMemo: vi.fn(),
	onPause: vi.fn(),
	onSubmit: vi.fn(),
};

describe("CashGameStackForm", () => {
	it("renders stack field and primary actions", () => {
		mocks.state.stackAmount = "";

		render(<CashGameStackForm {...defaultProps} />);

		expect(screen.getByLabelText("Current Stack *")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Complete" })
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "All-in" })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Add Chips" })
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Remove Chips" })
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Memo" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
	});

	it("calls onComplete with the current stack", async () => {
		const user = userEvent.setup();
		const onComplete = vi.fn();
		mocks.state.stackAmount = "4200";

		render(<CashGameStackForm {...defaultProps} onComplete={onComplete} />);

		await user.click(screen.getByRole("button", { name: "Complete" }));

		expect(onComplete).toHaveBeenCalledWith(4200);
	});

	it("submits stackAmount only on update", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		mocks.state.stackAmount = "5000";

		render(<CashGameStackForm {...defaultProps} onSubmit={onSubmit} />);

		await user.click(screen.getByRole("button", { name: "Update" }));

		expect(onSubmit).toHaveBeenCalledWith({ stackAmount: 5000 });
	});

	it("calls onAllIn immediately when all-in is submitted", async () => {
		const user = userEvent.setup();
		const onAllIn = vi.fn();
		mocks.state.stackAmount = "1000";

		render(<CashGameStackForm {...defaultProps} onAllIn={onAllIn} />);

		await user.click(screen.getByRole("button", { name: "All-in" }));
		await user.click(screen.getByRole("button", { name: "Mock Save All-in" }));

		expect(onAllIn).toHaveBeenCalledWith({
			equity: 40,
			potSize: 1200,
			trials: 2,
			wins: 1,
		});
	});

	it("adds an addon and increments the stack through the shared flow", async () => {
		const user = userEvent.setup();
		const onChipAdd = vi.fn();
		mocks.state.stackAmount = "1000";

		render(<CashGameStackForm {...defaultProps} onChipAdd={onChipAdd} />);

		await user.click(screen.getByRole("button", { name: "Add Chips" }));
		await user.click(screen.getByRole("button", { name: "Mock Save Addon" }));

		expect(onChipAdd).toHaveBeenCalledWith(300);
		expect(mocks.setStackAmount).toHaveBeenCalledWith("1300");
	});

	it("calls onPause when the Pause button is clicked", async () => {
		const user = userEvent.setup();
		const onPause = vi.fn();
		mocks.state.stackAmount = "";

		render(<CashGameStackForm {...defaultProps} onPause={onPause} />);

		await user.click(screen.getByRole("button", { name: "Pause" }));

		expect(onPause).toHaveBeenCalledOnce();
	});
});
