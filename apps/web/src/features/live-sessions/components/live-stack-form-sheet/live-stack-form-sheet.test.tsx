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
	chipPurchaseTypes: [] as Array<{ chips: number; cost: number; name: string }>,
	sessionData: null as null | { tournamentId: string | null },
	stackSheet: {
		close: vi.fn(),
		isOpen: true,
		open: vi.fn(),
		setIsOpen: vi.fn(),
	},
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
	useMutation: () => ({
		isPending: false,
		mutate: vi.fn(),
	}),
	useQuery: (options: { queryKey?: unknown[] }) => {
		const scope = options.queryKey?.[0];
		if (scope === "liveTournamentSession.getById") {
			return { data: mocks.sessionData };
		}
		if (scope === "tournamentChipPurchase.listByTournament") {
			return { data: mocks.chipPurchaseTypes };
		}
		return { data: undefined };
	},
	useQueryClient: () => ({
		invalidateQueries: vi.fn(),
	}),
}));

vi.mock("@/features/live-sessions/hooks/use-active-session", () => ({
	useActiveSession: () => ({
		activeSession: mocks.activeSession,
	}),
}));

vi.mock("@/features/live-sessions/hooks/use-stack-sheet", () => ({
	useStackSheet: () => mocks.stackSheet,
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

vi.mock("@/utils/trpc", () => ({
	trpc: {
		liveCashGameSession: {
			getById: {
				queryOptions: ({ id }: { id: string }) => ({
					queryKey: ["liveCashGameSession.getById", id],
				}),
			},
			list: {
				queryOptions: () => ({ queryKey: ["liveCashGameSession.list"] }),
			},
		},
		liveTournamentSession: {
			getById: {
				queryOptions: ({ id }: { id: string }) => ({
					queryKey: ["liveTournamentSession.getById", id],
				}),
			},
			list: {
				queryOptions: () => ({ queryKey: ["liveTournamentSession.list"] }),
			},
		},
		sessionEvent: {
			list: {
				queryOptions: (input: Record<string, string>) => ({
					queryKey: ["sessionEvent.list", input],
				}),
			},
		},
		tournamentChipPurchase: {
			listByTournament: {
				queryOptions: ({ tournamentId }: { tournamentId: string }) => ({
					queryKey: ["tournamentChipPurchase.listByTournament", tournamentId],
				}),
			},
		},
	},
	trpcClient: {
		liveCashGameSession: {
			complete: { mutate: vi.fn() },
		},
		liveTournamentSession: {
			complete: { mutate: vi.fn() },
		},
		sessionEvent: {
			create: { mutate: vi.fn() },
		},
	},
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
		mocks.sessionData = { tournamentId: "tour-1" };
		mocks.chipPurchaseTypes = [{ chips: 5000, cost: 1000, name: "Rebuy" }];

		render(<LiveStackFormSheet />);

		expect(screen.getByText("Record Stack")).toBeInTheDocument();

		await user.click(
			screen.getByRole("button", { name: "Open Tournament Complete" })
		);

		expect(screen.getByText("Complete Tournament")).toBeInTheDocument();
		expect(screen.getByText("Tournament Complete Form")).toBeInTheDocument();
	});
});
