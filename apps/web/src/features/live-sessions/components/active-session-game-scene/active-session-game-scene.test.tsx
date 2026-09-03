import { fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useState } from "react";
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
		mixGames?: Array<{
			ante: number | null;
			anteType: "all" | "bb" | "none";
			blind1: number | null;
			blind2: number | null;
			blind3: number | null;
			name: string | null;
			variants: string[];
		}> | null;
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
	ringGameFormProps: null as null | {
		defaultValues?: { mixGames?: unknown };
	},
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

vi.mock(
	"@/features/live-sessions/hooks/use-session-tournament-structure",
	() => ({
		useSessionTournamentStructure: () => {
			const t = mocks.tournament;
			const display = t
				? {
						ruleName: t.name,
						variant: t.variant,
						buyIn: t.buyIn,
						entryFee: t.entryFee,
						startingStack: t.startingStack,
						bountyAmount: t.bountyAmount,
						tableSize: t.tableSize,
					}
				: null;
			return {
				isLoading: false,
				display,
				blindLevels: mocks.levels,
				chipPurchases: mocks.chipPurchases,
			};
		},
	})
);

vi.mock("@/features/live-sessions/hooks/use-tournament-detail", () => ({
	useTournamentDetail: () => ({
		tournament: mocks.tournament ?? undefined,
		isTournamentLoading: false,
		chipPurchases: mocks.chipPurchases,
		levels: mocks.levels,
		isLevelsLoading: false,
		currencies: mocks.currencies,
	}),
}));

vi.mock("@/features/live-sessions/hooks/use-ring-game-scene-actions", () => ({
	useRingGameSceneActions: () => {
		const [isEditOpen, setIsEditOpen] = useState(false);
		return {
			isEditOpen,
			setIsEditOpen,
			handleUpdate: vi.fn(async () => undefined),
			isUpdatePending: false,
			currencies: mocks.currencies,
		};
	},
}));

vi.mock("@/features/live-sessions/hooks/use-tournament-scene-actions", () => ({
	useTournamentSceneActions: () => {
		const [isEditOpen, setIsEditOpen] = useState(false);
		return {
			isEditOpen,
			setIsEditOpen,
			handleSave: vi.fn(async () => undefined),
			isSaving: false,
			isUpdateWithLevelsPending: false,
		};
	},
}));

vi.mock("@/features/live-sessions/hooks/use-assign-dialog-state", () => ({
	useAssignDialogState: () => {
		const [isAssignOpen, setIsAssignOpen] = useState(false);
		return { isAssignOpen, setIsAssignOpen };
	},
}));

vi.mock("@/features/live-sessions/components/assign-ring-game-dialog", () => ({
	AssignRingGameDialog: () => null,
}));

vi.mock("@/features/live-sessions/components/assign-tournament-dialog", () => ({
	AssignTournamentDialog: () => null,
}));

vi.mock("@/features/rooms/components/ring-game-form", () => ({
	RingGameForm: (props: { defaultValues?: { mixGames?: unknown } }) => {
		mocks.ringGameFormProps = props;
		return <div data-testid="ring-game-form" />;
	},
}));

vi.mock("@/features/rooms/components/tournament-form-sheet", () => ({
	TournamentFormSheet: () => <div data-testid="tournament-form-sheet" />,
}));

vi.mock("@/shared/components/form-sheet", () => ({
	FormSheet: ({ children, open }: { children: ReactNode; open: boolean }) =>
		open ? <div>{children}</div> : null,
}));

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
		mocks.ringGameFormProps = null;
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

	it("passes the frozen session mix groups to the cash edit form", () => {
		const mixGames = [
			{
				ante: 1,
				anteType: "all" as const,
				blind1: 2,
				blind2: 4,
				blind3: null,
				name: "Big Bet",
				variants: ["NL Hold'em"],
			},
		];
		mocks.activeSession = {
			id: "session-1",
			type: "cash_game",
			status: "active",
		};
		mocks.cashSession = {
			id: "session-1",
			roomId: "room-1",
			ringGameId: "ring-1",
			ruleName: "Mixed Cash",
			variant: "Dealer's Choice",
			mixGames,
		};
		mocks.ringGames = [
			{
				ante: null,
				anteType: "none",
				archivedAt: null,
				blind1: null,
				blind2: null,
				blind3: null,
				createdAt: "",
				currencyId: "currency-1",
				id: "ring-1",
				maxBuyIn: null,
				memo: null,
				minBuyIn: null,
				mixGames: null,
				name: "Master Mix",
				roomId: "room-1",
				tableSize: null,
				updatedAt: "",
				variant: "Dealer's Choice",
			},
		];

		render(<ActiveSessionGameScene />);
		fireEvent.click(screen.getByRole("button", { name: "Edit" }));

		expect(mocks.ringGameFormProps?.defaultValues?.mixGames).toEqual(mixGames);
	});

	it.each([
		{
			type: "cash_game" as const,
			action: "Select or create a game",
			link: () => {
				mocks.cashSession = {
					id: "session-1",
					roomId: "room-1",
					ringGameId: null,
				};
			},
		},
		{
			type: "tournament" as const,
			action: "Select or create a tournament",
			link: () => {
				mocks.tournamentSession = {
					id: "session-2",
					roomId: "room-1",
					tournamentId: null,
				};
			},
		},
	])("shows the not-linked fallback with '$action' for an unlinked $type session", ({
		type,
		action,
		link,
	}) => {
		mocks.activeSession = { id: "session-1", type, status: "active" };
		link();

		render(<ActiveSessionGameScene />);
		expect(screen.getByText("Game not linked")).toBeInTheDocument();
		expect(screen.getByText(action)).toBeInTheDocument();
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

	it("shows the third blind for a regular tournament structure level", () => {
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
			name: "Stud Event",
			startingStack: 20_000,
			roomId: "room-1",
			tableSize: 8,
			tags: [],
			updatedAt: "",
			variant: "Razz",
		};
		mocks.levels = [
			{
				ante: 25,
				blind1: 100,
				blind2: 200,
				blind3: 75,
				id: "level-1",
				isBreak: false,
				level: 1,
				minutes: 20,
			},
		];

		render(<ActiveSessionGameScene />);

		expect(screen.getByRole("columnheader", { name: "Blind 3" })).toBeVisible();
		expect(screen.getByRole("cell", { name: "75" })).toBeVisible();
	});
});
