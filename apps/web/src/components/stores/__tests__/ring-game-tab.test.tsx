import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RingGameTab } from "../ring-game-tab";

const mocks = vi.hoisted(() => ({
	activeGames: [
		{
			ante: null,
			anteType: "none",
			archivedAt: null,
			blind1: 1,
			blind2: 2,
			blind3: null,
			currencyId: "currency-1",
			id: "game-1",
			maxBuyIn: 400,
			memo: "weekday deep stack",
			minBuyIn: 100,
			name: "1/2 NLH",
			storeId: "store-1",
			tableSize: 9,
			variant: "nlh",
		},
	],
	archiveMutate: vi.fn(async () => undefined),
	archivedGames: [] as unknown[],
	createMutate: vi.fn(async () => undefined),
	currencies: [{ id: "currency-1", name: "USD", unit: "$" }],
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
		if (scope === "ringGame") {
			return {
				data:
					archivedFlag === "archived" ? mocks.archivedGames : mocks.activeGames,
				isLoading: false,
			};
		}
		if (scope === "currency") {
			return { data: mocks.currencies, isLoading: false };
		}
		return { data: [], isLoading: false };
	},
	useQueryClient: () => ({
		invalidateQueries: mocks.invalidateQueries,
	}),
}));

vi.mock("@/components/stores/ring-game-form", () => ({
	RingGameForm: () => <div data-testid="ring-game-form" />,
}));

vi.mock("@/components/ui/responsive-dialog", () => ({
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
		currency: {
			list: {
				queryOptions: () => ({ queryKey: ["currency"] }),
			},
		},
		ringGame: {
			listByStore: {
				queryOptions: ({
					includeArchived,
					storeId,
				}: {
					includeArchived?: boolean;
					storeId: string;
				}) => ({
					queryKey: [
						"ringGame",
						storeId,
						includeArchived ? "archived" : "active",
					],
				}),
			},
		},
	},
	trpcClient: {
		ringGame: {
			archive: { mutate: mocks.archiveMutate },
			create: { mutate: mocks.createMutate },
			delete: { mutate: mocks.deleteMutate },
			restore: { mutate: mocks.restoreMutate },
			update: { mutate: mocks.updateMutate },
		},
	},
}));

function Harness() {
	const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
	return (
		<RingGameTab
			expandedGameId={expandedGameId}
			onToggleGame={setExpandedGameId}
			storeId="store-1"
		/>
	);
}

describe("RingGameTab", () => {
	beforeEach(() => {
		mocks.activeGames = [
			{
				ante: null,
				anteType: "none",
				archivedAt: null,
				blind1: 1,
				blind2: 2,
				blind3: null,
				currencyId: "currency-1",
				id: "game-1",
				maxBuyIn: 400,
				memo: "weekday deep stack",
				minBuyIn: 100,
				name: "1/2 NLH",
				storeId: "store-1",
				tableSize: 9,
				variant: "nlh",
			},
		];
		mocks.archiveMutate.mockClear();
	});

	it("expands a game row and archives it", async () => {
		const user = userEvent.setup();

		render(<Harness />);

		await user.click(screen.getByText("1/2 NLH"));
		expect(screen.getByText("weekday deep stack")).toBeInTheDocument();

		await user.click(screen.getByLabelText("Archive cash game"));

		await waitFor(() => {
			expect(mocks.archiveMutate).toHaveBeenCalledWith({ id: "game-1" });
		});
	});

	it("shows the empty state when there are no cash games", () => {
		mocks.activeGames = [];

		render(<Harness />);

		expect(screen.getByText("No cash games yet.")).toBeInTheDocument();
	});
});
