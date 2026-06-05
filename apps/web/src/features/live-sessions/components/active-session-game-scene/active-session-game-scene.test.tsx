import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActiveSessionGameScene } from "@/features/live-sessions/components/active-session-game-scene";

const mocks = vi.hoisted(() => ({
	activeSession: null as null | {
		id: string;
		type: "cash_game" | "tournament";
		status: "active" | "paused";
	},
	cashSession: null as null | {
		id: string;
		roomId: string;
		ringGameId: string | null;
		ruleName?: string | null;
		variant?: string | null;
		blind1?: number | null;
		blind2?: number | null;
		blind3?: number | null;
		ante?: number | null;
		anteType?: string | null;
		minBuyIn?: number | null;
		maxBuyIn?: number | null;
		tableSize?: number | null;
	},
	tournamentSession: null as null | {
		id: string;
		roomId: string;
		tournamentId: string | null;
	},
	ringGames: [] as unknown[],
	tournament: null as null | Record<string, unknown>,
	levels: [] as unknown[],
	chipPurchases: [] as unknown[],
	currencies: [] as unknown[],
}));

vi.mock("@/features/live-sessions/hooks/use-active-session", () => ({
	useActiveSession: () => ({
		activeSession: mocks.activeSession,
		hasActive: mocks.activeSession !== null,
		isLoading: false,
	}),
}));

vi.mock("@/features/live-sessions/hooks/use-cash-game-session", () => ({
	useCashGameSession: () => ({
		session: mocks.cashSession,
		ringGames: mocks.ringGames,
		isDiscardPending: false,
		discard: vi.fn(),
	}),
}));

vi.mock("@/features/live-sessions/hooks/use-tournament-session", () => ({
	useTournamentSession: () => ({
		session: mocks.tournamentSession,
		isDiscardPending: false,
		discard: vi.fn(),
	}),
}));

vi.mock("@/features/rooms/hooks/use-ring-games", () => ({
	useRingGames: () => ({
		update: vi.fn(async () => undefined),
		isUpdatePending: false,
		currencies: mocks.currencies,
	}),
}));

vi.mock("@/features/rooms/hooks/use-tournaments", () => ({
	useTournaments: () => ({
		isUpdateWithLevelsPending: false,
	}),
}));

vi.mock("@/features/rooms/components/ring-game-form", () => ({
	RingGameForm: () => <div data-testid="ring-game-form" />,
}));

vi.mock("@/features/rooms/components/tournament-edit-dialog", () => ({
	TournamentEditDialog: () => <div data-testid="tournament-edit-dialog" />,
}));

vi.mock("@/shared/components/ui/responsive-dialog", () => ({
	ResponsiveDialog: ({
		children,
		open,
	}: {
		children: ReactNode;
		open: boolean;
	}) => (open ? <div>{children}</div> : null),
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: (options: { queryKey: unknown[] }) => {
		const [scope] = options.queryKey as [string];
		if (scope === "tournament") {
			return { data: mocks.tournament, isLoading: false };
		}
		if (scope === "blindLevel") {
			return { data: mocks.levels, isLoading: false };
		}
		if (scope === "tournamentChipPurchase") {
			return { data: mocks.chipPurchases, isLoading: false };
		}
		if (scope === "liveTournamentSession") {
			// Mirrors the new snapshot fields returned by
			// `liveTournamentSession.getById`. The active scene reads the
			// session-level snapshot for display (name, blinds, chip purchases).
			const t = mocks.tournament;
			if (!t) {
				return { data: undefined, isLoading: false };
			}
			return {
				data: {
					ruleName: t.name,
					variant: t.variant,
					buyIn: t.buyIn,
					entryFee: t.entryFee,
					startingStack: t.startingStack,
					bountyAmount: t.bountyAmount,
					tableSize: t.tableSize,
					blindLevels: mocks.levels,
					chipPurchases: mocks.chipPurchases,
				},
				isLoading: false,
			};
		}
		if (scope === "currency") {
			return { data: mocks.currencies, isLoading: false };
		}
		if (scope === "liveCashGameSession") {
			return { data: undefined, isLoading: false };
		}
		return { data: undefined, isLoading: false };
	},
	useQueryClient: () => ({
		invalidateQueries: vi.fn(async () => undefined),
	}),
	useMutation: () => ({
		mutate: vi.fn(),
		mutateAsync: vi.fn(async () => undefined),
		isPending: false,
	}),
}));

vi.mock("@/utils/trpc", () => {
	const makeProc = (name: string) => ({
		queryOptions: () => ({ queryKey: [name] }),
	});
	return {
		trpc: {
			tournament: {
				getById: makeProc("tournament"),
				listByRoom: makeProc("tournament"),
			},
			tournamentChipPurchase: {
				listByTournament: makeProc("tournamentChipPurchase"),
			},
			blindLevel: {
				listByTournament: makeProc("blindLevel"),
			},
			liveCashGameSession: {
				getById: makeProc("liveCashGameSession"),
				list: makeProc("liveCashGameSession"),
			},
			liveTournamentSession: {
				getById: makeProc("liveTournamentSession"),
				list: makeProc("liveTournamentSession"),
			},
			currency: {
				list: makeProc("currency"),
			},
			room: {
				list: makeProc("room"),
			},
			ringGame: {
				listByRoom: makeProc("ringGame"),
			},
			session: {
				list: makeProc("session"),
			},
		},
		trpcClient: {
			tournament: {
				updateWithLevels: { mutate: vi.fn() },
				createWithLevels: { mutate: vi.fn() },
			},
			ringGame: {
				create: { mutate: vi.fn() },
			},
			liveCashGameSession: {
				update: { mutate: vi.fn() },
			},
			liveTournamentSession: {
				update: { mutate: vi.fn() },
			},
		},
	};
});

describe("ActiveSessionGameScene", () => {
	beforeEach(() => {
		mocks.activeSession = null;
		mocks.cashSession = null;
		mocks.tournamentSession = null;
		mocks.ringGames = [];
		mocks.tournament = null;
		mocks.levels = [];
		mocks.chipPurchases = [];
		mocks.currencies = [{ id: "currency-1", name: "USD", unit: "$" }];
	});

	it("shows the no-active-session empty state when there is no session", () => {
		render(<ActiveSessionGameScene />);
		expect(screen.getByText("No active session")).toBeInTheDocument();
	});

	it("renders ring game details for a cash game session", () => {
		mocks.activeSession = {
			id: "session-1",
			type: "cash_game",
			status: "active",
		};
		mocks.cashSession = {
			id: "session-1",
			roomId: "room-1",
			ringGameId: "ring-1",
			ruleName: "1/2 NLH",
			variant: "nlh",
			blind1: 1,
			blind2: 2,
			blind3: null,
			ante: null,
			anteType: "none",
			minBuyIn: 100,
			maxBuyIn: 400,
			tableSize: 9,
		};
		mocks.ringGames = [
			{
				ante: null,
				anteType: "none",
				archivedAt: null,
				blind1: 1,
				blind2: 2,
				blind3: null,
				createdAt: "",
				currencyId: "currency-1",
				id: "ring-1",
				maxBuyIn: 400,
				memo: "deep stack",
				minBuyIn: 100,
				name: "1/2 NLH",
				roomId: "room-1",
				tableSize: 9,
				updatedAt: "",
				variant: "nlh",
			},
		];

		render(<ActiveSessionGameScene />);
		expect(screen.getByText("1/2 NLH")).toBeInTheDocument();
		expect(screen.getByText("Cash Game")).toBeInTheDocument();
		expect(screen.getByText("deep stack")).toBeInTheDocument();
	});

	it("shows a fallback when the cash session has no ring game linked", () => {
		mocks.activeSession = {
			id: "session-1",
			type: "cash_game",
			status: "active",
		};
		mocks.cashSession = {
			id: "session-1",
			roomId: "room-1",
			ringGameId: null,
		};

		render(<ActiveSessionGameScene />);
		expect(screen.getByText("Game not linked")).toBeInTheDocument();
		expect(screen.getByText("Select or create a game")).toBeInTheDocument();
	});

	it("shows a fallback with an assign action when the tournament session has no tournament linked", () => {
		mocks.activeSession = {
			id: "session-2",
			type: "tournament",
			status: "active",
		};
		mocks.tournamentSession = {
			id: "session-2",
			roomId: "room-1",
			tournamentId: null,
		};

		render(<ActiveSessionGameScene />);
		expect(screen.getByText("Game not linked")).toBeInTheDocument();
		expect(
			screen.getByText("Select or create a tournament")
		).toBeInTheDocument();
	});

	it("renders tournament details", () => {
		mocks.activeSession = {
			id: "session-2",
			type: "tournament",
			status: "active",
		};
		mocks.tournamentSession = {
			id: "session-2",
			roomId: "room-1",
			tournamentId: "tour-1",
		};
		mocks.tournament = {
			archivedAt: null,
			bountyAmount: null,
			buyIn: 10_000,
			createdAt: "",
			currencyId: "currency-1",
			entryFee: 1000,
			id: "tour-1",
			memo: null,
			name: "Weekly Deepstack",
			startingStack: 20_000,
			roomId: "room-1",
			tableSize: 9,
			tags: [],
			updatedAt: "",
			variant: "nlh",
		};
		mocks.levels = [];

		render(<ActiveSessionGameScene />);
		expect(screen.getByText("Weekly Deepstack")).toBeInTheDocument();
		expect(screen.getByText("Tournament")).toBeInTheDocument();
	});
});
