import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { SessionEventsScene } from "./session-events-scene";

const mocks = vi.hoisted(() => ({
	deleteMutate: vi.fn(async () => undefined),
	events: [] as Array<{
		eventType: string;
		id: string;
		occurredAt: string;
		payload: Record<string, unknown>;
	}>,
	invalidateQueries: vi.fn(),
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
			mutate,
			mutateAsync: mutate,
		};
	},
	useQuery: () => ({ data: mocks.events }),
	useQueryClient: () => ({
		cancelQueries: vi.fn(),
		getQueryData: vi.fn(),
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
		liveCashGameSession: {
			getById: {
				queryOptions: ({ id }: { id: string }) => ({
					queryKey: ["cash-session", id],
				}),
			},
		},
		liveTournamentSession: {
			getById: {
				queryOptions: ({ id }: { id: string }) => ({
					queryKey: ["tournament-session", id],
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
	},
	trpcClient: {
		sessionEvent: {
			delete: { mutate: mocks.deleteMutate },
			update: { mutate: mocks.updateMutate },
		},
	},
}));

const ADDON_AMOUNT_LABEL = /Addon Amount/;
const COST_LABEL = /^Cost/;

describe("SessionEventsScene", () => {
	it("updates a chips add/remove event from the shared scene", async () => {
		const user = userEvent.setup();
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
		await user.clear(screen.getByLabelText(ADDON_AMOUNT_LABEL));
		await user.type(screen.getByLabelText(ADDON_AMOUNT_LABEL), "7500");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mocks.updateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "event-1",
					payload: expect.objectContaining({ amount: 7500 }),
				})
			);
		});
	});

	it("updates a purchase chips event from the shared scene", async () => {
		const user = userEvent.setup();
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
		await user.clear(screen.getByLabelText(COST_LABEL));
		await user.type(screen.getByLabelText(COST_LABEL), "200");
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
	});
});
