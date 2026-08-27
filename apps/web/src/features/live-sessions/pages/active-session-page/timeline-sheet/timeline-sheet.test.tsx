import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const trpcMocks = vi.hoisted(() => ({
	update: vi.fn(),
	delete: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		sessionEvent: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("sessionEvent", "list", input),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		liveCashGameSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "getById", input),
				}),
			},
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "list", input),
				}),
			},
		},
		liveTournamentSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "getById", input),
				}),
			},
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "list", input),
				}),
			},
		},
		sessionTablePlayer: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("sessionTablePlayer", "list", input),
					queryFn: () => Promise.resolve({ items: [] }),
				}),
			},
		},
		session: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("session", "getById", input),
				}),
			},
			list: {
				queryKey: () => ["session", "list"],
			},
		},
	},
	trpcClient: {
		sessionEvent: {
			update: { mutate: trpcMocks.update },
			delete: { mutate: trpcMocks.delete },
		},
	},
}));

import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";
import { TimelineSheet } from "@/features/live-sessions/pages/active-session-page/timeline-sheet";

const TIMELINE_ITEM_TESTID_PATTERN = /timeline-item-/;
const SIGNED_AMOUNT_PATTERN = /[+-][\d,]+/;

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
			mutations: { retry: false },
		},
	});
}

function renderSheet(events: SessionEvent[], open = true) {
	const qc = createClient();
	qc.setQueryData(
		["sessionEvent", "list", { liveCashGameSessionId: "s1" }],
		events
	);
	function Wrapper({ children }: { children: ReactNode }) {
		return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
	}
	return render(
		<TimelineSheet
			onOpenChange={vi.fn()}
			open={open}
			sessionId="s1"
			sessionType="cash_game"
		/>,
		{ wrapper: Wrapper }
	);
}

describe("TimelineSheet", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("renders nothing visible when closed", () => {
		renderSheet([], false);
		expect(screen.queryByText("Event timeline")).not.toBeInTheDocument();
	});

	it("shows a loading line synchronously before the query resolves", () => {
		const qc = createClient();
		function Wrapper({ children }: { children: ReactNode }) {
			return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
		}
		render(
			<TimelineSheet
				onOpenChange={vi.fn()}
				open
				sessionId="s1"
				sessionType="cash_game"
			/>,
			{ wrapper: Wrapper }
		);
		expect(screen.getByText("Loading...")).toBeInTheDocument();
	});

	it("shows the empty state when there are no events", () => {
		renderSheet([]);
		expect(screen.getByText("No events yet")).toBeInTheDocument();
	});

	it("renders rows in the same order as the events", () => {
		const events: SessionEvent[] = [
			{
				id: "e1",
				eventType: "session_start",
				payload: { buyInAmount: 10_000 },
				occurredAt: "2026-04-10T09:00:00",
			},
			{
				id: "e2",
				eventType: "memo",
				payload: { text: "note" },
				occurredAt: "2026-04-10T09:05:00",
			},
		];
		renderSheet(events);
		const rows = screen.getAllByTestId(TIMELINE_ITEM_TESTID_PATTERN);
		expect(rows.map((row) => row.dataset.testid)).toEqual([
			"timeline-item-e1",
			"timeline-item-e2",
		]);
	});

	it("shows the amount only for events that carry one", () => {
		const events: SessionEvent[] = [
			{
				id: "e1",
				eventType: "chips_add_remove",
				payload: { amount: 5000 },
				occurredAt: "2026-04-10T09:00:00",
			},
			{
				id: "e2",
				eventType: "memo",
				payload: { text: "note" },
				occurredAt: "2026-04-10T09:05:00",
			},
		];
		renderSheet(events);
		expect(screen.getByText("+5,000")).toBeInTheDocument();
		expect(screen.getByTestId("timeline-item-e2").textContent).not.toMatch(
			SIGNED_AMOUNT_PATTERN
		);
	});

	it("opens the edit sheet with the tapped event exactly once when a row is tapped", async () => {
		const user = userEvent.setup();
		const events: SessionEvent[] = [
			{
				id: "e1",
				eventType: "memo",
				payload: { text: "old note" },
				occurredAt: "2026-04-10T09:00:00",
			},
		];
		renderSheet(events);
		expect(screen.queryByText("Edit Memo")).not.toBeInTheDocument();
		await user.click(screen.getByTestId("timeline-item-e1"));
		expect(
			screen.getByRole("heading", { name: "Edit Memo" })
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
	});

	it("closes the edit sheet without reopening the tapped event twice", async () => {
		const user = userEvent.setup();
		const events: SessionEvent[] = [
			{
				id: "e1",
				eventType: "memo",
				payload: { text: "old note" },
				occurredAt: "2026-04-10T09:00:00",
			},
		];
		renderSheet(events);
		await user.click(screen.getByTestId("timeline-item-e1"));
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(screen.queryByText("Edit Memo")).not.toBeInTheDocument();
	});
});
