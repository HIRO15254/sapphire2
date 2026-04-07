import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TournamentTab } from "../tournament-tab";

const mocks = vi.hoisted(() => ({
	activeTournaments: [
		{
			archivedAt: null,
			blindLevelCount: 0,
			bountyAmount: null,
			buyIn: 10_000,
			chipPurchases: [],
			currencyId: "currency-1",
			entryFee: 1000,
			id: "tournament-1",
			memo: "two day structure",
			name: "Sunday Major",
			startingStack: 20_000,
			storeId: "store-1",
			tableSize: 9,
			tags: [],
			variant: "nlh",
		},
	],
	archiveMutate: vi.fn(async () => undefined),
	archivedTournaments: [] as unknown[],
	createMutate: vi.fn(async () => undefined),
	deleteMutate: vi.fn(async () => undefined),
	invalidateQueries: vi.fn(),
	restoreMutate: vi.fn(async () => undefined),
	updateMutate: vi.fn(async () => undefined),
}));

vi.mock("@tanstack/react-query", () => ({
	useMutation: (options: {
		mutationFn: (arg: unknown) => Promise<unknown> | unknown;
		onSettled?: () => void;
		onSuccess?: () => void;
	}) => ({
		isPending: false,
		mutate: async (arg: unknown) => {
			await options.mutationFn(arg);
			await options.onSuccess?.();
			await options.onSettled?.();
		},
	}),
	useQuery: (options: { queryKey: unknown[] }) => {
		const [scope, _storeId, archivedFlag] = options.queryKey as [
			string,
			string?,
			string?,
		];
		if (scope === "tournament") {
			return {
				data:
					archivedFlag === "archived"
						? mocks.archivedTournaments
						: mocks.activeTournaments,
				isLoading: false,
			};
		}
		return { data: [], isLoading: false };
	},
	useQueryClient: () => ({
		invalidateQueries: mocks.invalidateQueries,
	}),
}));

vi.mock("@/stores/components/tournament-form", () => ({
	TournamentForm: () => <div data-testid="tournament-form" />,
}));

vi.mock("@/stores/components/blind-level-editor", () => ({
	BlindLevelEditor: ({ open }: { open: boolean }) =>
		open ? <div>Blind editor</div> : null,
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

vi.mock("@/utils/trpc", () => ({
	trpc: {
		tournament: {
			listByStore: {
				queryOptions: ({
					includeArchived,
					storeId,
				}: {
					includeArchived?: boolean;
					storeId: string;
				}) => ({
					queryKey: [
						"tournament",
						storeId,
						includeArchived ? "archived" : "active",
					],
				}),
			},
		},
	},
	trpcClient: {
		tournament: {
			addTag: { mutate: vi.fn(async () => undefined) },
			archive: { mutate: mocks.archiveMutate },
			create: { mutate: mocks.createMutate },
			delete: { mutate: mocks.deleteMutate },
			removeTag: { mutate: vi.fn(async () => undefined) },
			restore: { mutate: mocks.restoreMutate },
			update: { mutate: mocks.updateMutate },
		},
		tournamentChipPurchase: {
			create: { mutate: vi.fn(async () => undefined) },
			delete: { mutate: vi.fn(async () => undefined) },
		},
	},
}));

function Harness() {
	const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
	return (
		<TournamentTab
			expandedGameId={expandedGameId}
			onToggleGame={setExpandedGameId}
			storeId="store-1"
		/>
	);
}

describe("TournamentTab", () => {
	beforeEach(() => {
		mocks.activeTournaments = [
			{
				archivedAt: null,
				blindLevelCount: 0,
				bountyAmount: null,
				buyIn: 10_000,
				chipPurchases: [],
				currencyId: "currency-1",
				entryFee: 1000,
				id: "tournament-1",
				memo: "two day structure",
				name: "Sunday Major",
				startingStack: 20_000,
				storeId: "store-1",
				tableSize: 9,
				tags: [],
				variant: "nlh",
			},
		];
		mocks.archiveMutate.mockClear();
	});

	it("expands a tournament row and archives it", async () => {
		const user = userEvent.setup();

		render(<Harness />);

		await user.click(screen.getByText("Sunday Major"));
		expect(screen.getByText("two day structure")).toBeInTheDocument();

		await user.click(screen.getByLabelText("Archive tournament"));

		await waitFor(() => {
			expect(mocks.archiveMutate).toHaveBeenCalledWith({
				id: "tournament-1",
			});
		});
	});

	it("shows the empty state when there are no tournaments", () => {
		mocks.activeTournaments = [];

		render(<Harness />);

		expect(screen.getByText("No tournaments yet.")).toBeInTheDocument();
	});
});
