import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
		expect(await screen.findByText("Not enough data yet")).toBeInTheDocument();
	});

	it("shows a retryable error instead of the empty state when the query fails", async () => {
		queryFn.mockClear();
		queryFn.mockRejectedValueOnce(new Error("Request failed"));
		queryFn.mockResolvedValueOnce([]);
		const user = userEvent.setup();
		render(
			wrap(
				createElement(SessionResultChart, {
					enabled: true,
					liveSessionId: "s1",
					sessionType: "cash_game",
				})
			)
		);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Unable to load statistics"
		);
		expect(screen.queryByText("Not enough data yet")).toBeNull();

		await user.click(screen.getByRole("button", { name: "Retry" }));
		await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
		expect(await screen.findByText("Not enough data yet")).toBeTruthy();
	});

	it.each([
		{
			sessionType: "cash_game" as const,
			liveSessionId: "cash-1",
			events: [
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
			],
		},
		{
			sessionType: "tournament" as const,
			liveSessionId: "trn-1",
			events: [
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
			],
		},
	])("renders the chart impl with $sessionType points passed through", async ({
		sessionType,
		liveSessionId,
		events,
	}) => {
		queryFn.mockClear();
		queryFn.mockResolvedValueOnce(events);
		render(
			wrap(
				createElement(SessionResultChart, {
					enabled: true,
					liveSessionId,
					sessionType,
				})
			)
		);
		const impl = await screen.findByTestId("chart-impl");
		expect(impl.getAttribute("data-session-type")).toBe(sessionType);
		expect(impl.getAttribute("data-point-count")).toBe("2");
	});
});
