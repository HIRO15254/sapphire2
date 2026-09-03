import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { LiveStackFormSheet } from "./live-stack-form-sheet";

const mocks = vi.hoisted(() => ({
	activeSession: null as null | {
		id: string;
		type: "cash_game" | "tournament";
	},
	stackSheet: {
		close: vi.fn(),
		isOpen: true,
		open: vi.fn(),
		setIsOpen: vi.fn(),
	},
}));

vi.mock("@/features/live-sessions/hooks/use-active-session", () => ({
	useActiveSession: () => ({
		activeSession: mocks.activeSession,
	}),
}));

vi.mock("@/features/live-sessions/hooks/use-stack-sheet", () => ({
	useStackSheet: () => mocks.stackSheet,
}));

vi.mock("@/features/live-sessions/hooks/use-cash-game-stack", () => ({
	useCashGameStack: () => ({
		addAllIn: vi.fn(),
		addChip: vi.fn(),
		addMemo: vi.fn(),
		complete: vi.fn(),
		isCompletePending: false,
		isStackPending: false,
		pause: vi.fn(),
		recordStack: vi.fn(),
		removeChip: vi.fn(),
	}),
}));

vi.mock("@/features/live-sessions/hooks/use-tournament-stack", () => ({
	useTournamentStack: () => ({
		addMemo: vi.fn(),
		chipPurchaseTypes: [],
		complete: vi.fn(),
		isCompletePending: false,
		isStackPending: false,
		pause: vi.fn(),
		purchaseChips: vi.fn(),
		recordStack: vi.fn(),
	}),
}));

vi.mock("@/shared/components/form-sheet", () => ({
	FormSheet: ({
		children,
		formId,
		open,
		title,
	}: {
		children: ReactNode;
		formId: string;
		open: boolean;
		title: string;
	}) =>
		open ? (
			<div>
				<h2>{title}</h2>
				{children}
				<button aria-label={`Save ${title}`} form={formId} type="submit">
					Save
				</button>
			</div>
		) : null,
}));

vi.mock("@/features/live-sessions/components/cash-game-stack-form", () => ({
	CashGameStackForm: ({
		onComplete,
	}: {
		onComplete: (stack: number) => void;
	}) => (
		<button onClick={() => onComplete(4500)} type="button">
			Open Cash Complete
		</button>
	),
}));

vi.mock("@/features/live-sessions/components/cash-game-complete-form", () => ({
	CashGameCompleteForm: () => <div>Cash Complete Form</div>,
}));

vi.mock("@/features/live-sessions/components/tournament-stack-form", () => ({
	TournamentStackForm: ({ onComplete }: { onComplete: () => void }) => (
		<button onClick={() => onComplete()} type="button">
			Open Tournament Complete
		</button>
	),
}));

vi.mock("@/features/live-sessions/components/tournament-complete-form", () => ({
	TournamentCompleteForm: () => <div>Tournament Complete Form</div>,
}));

describe("LiveStackFormSheet", () => {
	it("renders the cash stack dialog and opens the complete flow", async () => {
		const user = userEvent.setup();
		mocks.activeSession = { id: "cash-1", type: "cash_game" };

		render(<LiveStackFormSheet />);

		expect(screen.getByText("Record Stack")).toBeInTheDocument();

		await user.click(
			screen.getByRole("button", { name: "Open Cash Complete" })
		);

		expect(screen.getByText("Complete Session")).toBeInTheDocument();
		expect(screen.getByText("Cash Complete Form")).toBeInTheDocument();
	});

	it("renders the tournament stack dialog and opens the complete flow", async () => {
		const user = userEvent.setup();
		mocks.activeSession = { id: "tournament-1", type: "tournament" };

		render(<LiveStackFormSheet />);

		expect(screen.getByText("Record Stack")).toBeInTheDocument();

		await user.click(
			screen.getByRole("button", { name: "Open Tournament Complete" })
		);

		expect(screen.getByText("Complete Tournament")).toBeInTheDocument();
		expect(screen.getByText("Tournament Complete Form")).toBeInTheDocument();
	});
});
