import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { SessionEventsScene } from "../session-events-scene";

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

describe("SessionEventsScene", () => {
	it("updates a chip add event from the shared scene", async () => {
		const user = userEvent.setup();
		mocks.events = [
			{
				eventType: "chip_add",
				id: "event-1",
				occurredAt: "2026-04-03T10:00:00.000Z",
				payload: { amount: 5000 },
			},
		];

		render(
			<SessionEventsScene sessionId="session-1" sessionType="cash_game" />
		);

		await user.click(screen.getByLabelText("Edit Chip Add"));
		await user.clear(screen.getByLabelText("Amount"));
		await user.type(screen.getByLabelText("Amount"), "7500");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mocks.updateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "event-1",
					payload: { amount: 7500 },
				})
			);
		});
	});

	it("updates a tournament result event from the shared scene", async () => {
		const user = userEvent.setup();
		mocks.events = [
			{
				eventType: "tournament_result",
				id: "event-2",
				occurredAt: "2026-04-03T12:30:00.000Z",
				payload: {
					bountyPrizes: 0,
					placement: 3,
					prizeMoney: 20_000,
					totalEntries: 100,
				},
			},
		];

		render(
			<SessionEventsScene sessionId="session-2" sessionType="tournament" />
		);

		await user.click(screen.getByLabelText("Edit Tournament Result"));
		await user.clear(screen.getByLabelText("Placement"));
		await user.type(screen.getByLabelText("Placement"), "2");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mocks.updateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "event-2",
					payload: expect.objectContaining({
						placement: 2,
						totalEntries: 100,
						prizeMoney: 20_000,
					}),
				})
			);
		});
	});
});
