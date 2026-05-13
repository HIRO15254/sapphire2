import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const queryFn = vi.fn(async () => [] as unknown[]);

vi.mock("@/utils/trpc", () => ({
	trpc: {
		sessionEvent: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: ["sessionEvent", "list", input],
					queryFn,
				}),
			},
		},
	},
}));

// Avoid actually loading recharts in tests; the wrapper's lazy boundary still
// resolves, but the impl module is replaced with a tiny stub so jsdom doesn't
// have to render SVG.
vi.mock(
	"@/features/live-sessions/components/session-result-chart/session-result-chart-impl",
	() => ({
		default: ({
			points,
			sessionType,
		}: {
			points: unknown[];
			sessionType: string;
		}) =>
			createElement(
				"div",
				{
					"data-testid": "chart-impl",
					"data-session-type": sessionType,
					"data-point-count": String(points.length),
				},
				"chart"
			),
	})
);

import { SessionResultChart } from "@/features/live-sessions/components/session-result-chart/session-result-chart";

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
			mutations: { retry: false },
		},
	});
}

function wrap(ui: ReactNode) {
	return createElement(QueryClientProvider, { client: createClient() }, ui);
}

describe("SessionResultChart", () => {
	it("renders nothing when enabled=false", () => {
		queryFn.mockClear();
		const { container } = render(
			wrap(
				createElement(SessionResultChart, {
					enabled: false,
					liveSessionId: "s1",
					sessionType: "cash_game",
				})
			)
		);
		expect(container.firstChild).toBeNull();
		expect(queryFn).not.toHaveBeenCalled();
	});

	it("renders the empty state when fewer than 2 derived points", async () => {
		queryFn.mockClear();
		queryFn.mockResolvedValueOnce([]);
		render(
			wrap(
				createElement(SessionResultChart, {
					enabled: true,
					liveSessionId: "s1",
					sessionType: "cash_game",
				})
			)
		);
		expect(await screen.findByText("Not enough data yet")).toBeTruthy();
	});

	it("renders the chart impl when there are >=2 derived cash points", async () => {
		queryFn.mockClear();
		queryFn.mockResolvedValueOnce([
			{
				id: "e1",
				eventType: "session_start",
				occurredAt: "2026-04-01T10:00:00Z",
				payload: { buyInAmount: 10_000 },
			},
			{
				id: "e2",
				eventType: "update_stack",
				occurredAt: "2026-04-01T10:30:00Z",
				payload: { stackAmount: 12_000 },
			},
		]);
		render(
			wrap(
				createElement(SessionResultChart, {
					enabled: true,
					liveSessionId: "cash-1",
					sessionType: "cash_game",
				})
			)
		);
		const impl = await screen.findByTestId("chart-impl");
		expect(impl.getAttribute("data-session-type")).toBe("cash_game");
		expect(impl.getAttribute("data-point-count")).toBe("2");
	});

	it("passes tournament points through to the impl", async () => {
		queryFn.mockClear();
		queryFn.mockResolvedValueOnce([
			{
				id: "e1",
				eventType: "session_start",
				occurredAt: "2026-04-01T10:00:00Z",
				payload: {},
			},
			{
				id: "e2",
				eventType: "update_stack",
				occurredAt: "2026-04-01T10:05:00Z",
				payload: { stackAmount: 10_000 },
			},
		]);
		render(
			wrap(
				createElement(SessionResultChart, {
					enabled: true,
					liveSessionId: "trn-1",
					sessionType: "tournament",
				})
			)
		);
		await waitFor(() =>
			expect(screen.queryByTestId("chart-impl")).not.toBeNull()
		);
		const impl = screen.getByTestId("chart-impl");
		expect(impl.getAttribute("data-session-type")).toBe("tournament");
		expect(impl.getAttribute("data-point-count")).toBe("2");
	});
});
