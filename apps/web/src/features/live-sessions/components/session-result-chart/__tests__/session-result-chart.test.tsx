import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

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

import { SessionResultChart } from "@/features/live-sessions/components/session-result-chart/session-result-chart";

const CASH_CHART_SUMMARY = /Cash game result chart/;
const TOURNAMENT_CHART_SUMMARY = /Tournament result chart/;

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
	beforeAll(async () => {
		await import("../session-result-chart-impl");
	});
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

	it("derives cash events into the real chart's accessible series summary", async () => {
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
		expect(await screen.findByText(CASH_CHART_SUMMARY)).toHaveTextContent(
			"P&L and EV P&L series with 2 data points"
		);
	});

	it.each([
		{ info: {}, summary: "Stack series with 3 data points" },
		{
			info: { remainingPlayers: 20, totalEntries: 100 },
			summary: "Stack and Avg stack series with 3 data points",
		},
	])("derives tournament events into $summary", async ({ info, summary }) => {
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
			{
				id: "e3",
				eventType: "update_stack",
				occurredAt: "2026-04-01T10:15:00Z",
				payload: { stackAmount: 15_000, ...info },
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
		expect(await screen.findByText(TOURNAMENT_CHART_SUMMARY)).toHaveTextContent(
			summary
		);
	});
});
