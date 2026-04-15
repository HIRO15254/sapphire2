import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionEventsScene } from "../session-events-scene";

const mocks = vi.hoisted(() => ({
	cashSession: null as null | {
		currencyId: string | null;
		summary?: Record<string, unknown>;
	},
	deleteMutate: vi.fn(async () => undefined),
	events: [] as Array<{
		eventType: string;
		id: string;
		occurredAt: string;
		payload: Record<string, unknown>;
	}>,
	getQueryData: vi.fn(),
	invalidateQueries: vi.fn(),
	tournamentSession: null as null | {
		currencyId: string | null;
		summary?: Record<string, unknown>;
	},
	updateMutate: vi.fn(async () => undefined),
}));

vi.mock("@tanstack/react-query", () => ({
	useMutation: (options: {
		mutationFn: (arg: unknown) => Promise<unknown> | unknown;
		onSuccess?: () => void;
	}) => {
		const mutate = async (arg: unknown) => {
			const result = await options.mutationFn(arg);
			await options.onSuccess?.();
			return result;
		};
		return {
			isPending: false,
			mutate: vi.fn(),
			mutateAsync: mutate,
		};
	},
	useQuery: (options: { queryKey?: unknown[] }) => {
		const scope = options.queryKey?.[0];
		if (scope === "events") {
			return { data: mocks.events };
		}
		if (scope === "cash-session") {
			return { data: mocks.cashSession };
		}
		if (scope === "tournament-session") {
			return { data: mocks.tournamentSession };
		}
		return { data: undefined };
	},
	useQueryClient: () => ({
		cancelQueries: vi.fn(),
		getQueryData: mocks.getQueryData,
		invalidateQueries: mocks.invalidateQueries,
		setQueryData: vi.fn(),
	}),
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
		currency: {
			list: {
				queryOptions: () => ({
					queryKey: ["currency-list"],
				}),
			},
		},
		currencyTransaction: {
			listByCurrency: {
				queryOptions: ({ currencyId }: { currencyId: string }) => ({
					queryKey: ["currency-transaction-list", currencyId],
				}),
			},
		},
		liveCashGameSession: {
			getById: {
				queryOptions: ({ id }: { id: string }) => ({
					queryKey: ["cash-session", id],
				}),
			},
			list: {
				queryOptions: (input: Record<string, unknown>) => ({
					queryKey: ["cash-session-list", input],
				}),
			},
		},
		liveTournamentSession: {
			getById: {
				queryOptions: ({ id }: { id: string }) => ({
					queryKey: ["tournament-session", id],
				}),
			},
			list: {
				queryOptions: (input: Record<string, unknown>) => ({
					queryKey: ["tournament-session-list", input],
				}),
			},
		},
		session: {
			list: {
				queryOptions: () => ({
					queryKey: ["session-list"],
				}),
			},
		},
		sessionEvent: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: ["events", input],
				}),
			},
		},
		sessionTablePlayer: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: ["players", input],
				}),
			},
		},
	},
	trpcClient: {
		sessionEvent: {
			delete: { mutate: mocks.deleteMutate },
			update: { mutate: mocks.updateMutate },
		},
	},
}));

beforeEach(() => {
	mocks.cashSession = null;
	mocks.tournamentSession = null;
	mocks.events = [];
	mocks.deleteMutate.mockClear();
	mocks.getQueryData.mockReset();
	mocks.invalidateQueries.mockClear();
	mocks.updateMutate.mockClear();
});

function hasInvalidationFor(queryKey: unknown[]) {
	return mocks.invalidateQueries.mock.calls.some(
		([args]) => JSON.stringify(args) === JSON.stringify({ queryKey })
	);
}

describe("SessionEventsScene", () => {
	it("invalidates dependent session and currency queries after cash event updates", async () => {
		const user = userEvent.setup();
		mocks.cashSession = { currencyId: "currency-1", summary: {} };
		mocks.events = [
			{
				eventType: "chips_add_remove",
				id: "event-1",
				occurredAt: "2026-04-03T10:00:00.000Z",
				payload: { amount: 5000, type: "add" },
			},
		];

		render(
			<SessionEventsScene sessionId="session-1" sessionType="cash_game" />
		);

		await user.click(screen.getByLabelText("Edit Chips Add/Remove"));
		await user.clear(screen.getByLabelText("Amount"));
		await user.type(screen.getByLabelText("Amount"), "7500");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mocks.updateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "event-1",
					payload: expect.objectContaining({ amount: 7500 }),
				})
			);
		});

		await waitFor(() => {
			const queryKeys = [
				["events", { liveCashGameSessionId: "session-1" }],
				["cash-session", "session-1"],
				["cash-session-list", {}],
				["cash-session-list", { status: "active", limit: 1 }],
				["cash-session-list", { status: "paused", limit: 1 }],
				["session-list"],
				["currency-list"],
				["currency-transaction-list", "currency-1"],
			];
			for (const queryKey of queryKeys) {
				expect(hasInvalidationFor(queryKey)).toBe(true);
			}
		});
	});

	it("invalidates dependent session and currency queries after tournament event updates", async () => {
		const user = userEvent.setup();
		mocks.tournamentSession = { currencyId: "currency-2", summary: {} };
		mocks.events = [
			{
				eventType: "purchase_chips",
				id: "event-2",
				occurredAt: "2026-04-03T12:30:00.000Z",
				payload: {
					name: "Rebuy",
					cost: 100,
					chips: 10_000,
				},
			},
		];

		render(
			<SessionEventsScene sessionId="session-2" sessionType="tournament" />
		);

		await user.click(screen.getByLabelText("Edit Purchase Chips"));
		await user.clear(screen.getByLabelText("Cost"));
		await user.type(screen.getByLabelText("Cost"), "200");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mocks.updateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "event-2",
					payload: expect.objectContaining({
						cost: 200,
					}),
				})
			);
		});

		await waitFor(() => {
			const queryKeys = [
				["events", { liveTournamentSessionId: "session-2" }],
				["tournament-session", "session-2"],
				["tournament-session-list", {}],
				["tournament-session-list", { status: "active", limit: 1 }],
				["tournament-session-list", { status: "paused", limit: 1 }],
				["session-list"],
				["currency-list"],
				["currency-transaction-list", "currency-2"],
			];
			for (const queryKey of queryKeys) {
				expect(hasInvalidationFor(queryKey)).toBe(true);
			}
		});
	});

	it("skips currency transaction invalidation when deleting an event from a session without currency", async () => {
		const user = userEvent.setup();
		mocks.cashSession = { currencyId: null, summary: {} };
		mocks.events = [
			{
				eventType: "memo",
				id: "event-3",
				occurredAt: "2026-04-03T14:00:00.000Z",
				payload: { text: "note" },
			},
		];

		render(
			<SessionEventsScene sessionId="session-3" sessionType="cash_game" />
		);

		await user.click(screen.getByLabelText("Delete Memo"));
		await user.click(screen.getByLabelText("Confirm delete"));

		await waitFor(() => {
			expect(mocks.deleteMutate).toHaveBeenCalledWith({ id: "event-3" });
		});

		await waitFor(() => {
			const queryKeys = [
				["events", { liveCashGameSessionId: "session-3" }],
				["cash-session", "session-3"],
				["cash-session-list", {}],
				["cash-session-list", { status: "active", limit: 1 }],
				["cash-session-list", { status: "paused", limit: 1 }],
				["session-list"],
				["currency-list"],
			];
			for (const queryKey of queryKeys) {
				expect(hasInvalidationFor(queryKey)).toBe(true);
			}
			expect(mocks.invalidateQueries).not.toHaveBeenCalledWith({
				queryKey: ["currency-transaction-list", expect.any(String)],
			});
		});
	});
});
