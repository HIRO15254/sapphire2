import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
	useRouterState,
	useSearch,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	isDefaultStatsFilterState,
	statsSearchSchema,
} from "@/features/statistics/utils/stats-filters";

function StatisticsProbe() {
	const validated = useSearch({ from: "/statistics" });
	const raw = useRouterState({ select: (s) => s.location.search });
	const href = useRouterState({ select: (s) => s.location.href });
	return (
		<>
			<output data-testid="raw">{JSON.stringify(raw)}</output>
			<output data-testid="validated">{JSON.stringify(validated)}</output>
			<output data-testid="href">{href}</output>
			<output data-testid="verdict">
				{String(isDefaultStatsFilterState(validated))}
			</output>
		</>
	);
}

function renderStatisticsRoute(initialUrl: string) {
	const rootRoute = createRootRoute();
	const statisticsRoute = createRoute({
		component: StatisticsProbe,
		getParentRoute: () => rootRoute,
		path: "/statistics",
		validateSearch: statsSearchSchema,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([statisticsRoute]),
		history: createMemoryHistory({ initialEntries: [initialUrl] }),
	});
	render(<RouterProvider router={router} />);
}

async function readProbe() {
	return {
		raw: JSON.parse((await screen.findByTestId("raw")).textContent ?? "{}"),
		validated: JSON.parse(
			(await screen.findByTestId("validated")).textContent ?? "{}"
		),
		href: (await screen.findByTestId("href")).textContent ?? "",
		verdict: (await screen.findByTestId("verdict")).textContent === "true",
	};
}

describe("statistics route: validateSearch bakes defaults into location.search", () => {
	it("puts the schema defaults into the raw search AND the URL for a bare /statistics", async () => {
		renderStatisticsRoute("/statistics");
		const { raw, href } = await readProbe();

		expect(Object.keys(raw as object).length).toBeGreaterThan(0);
		expect(raw).toMatchObject({
			period: "all",
			norm: "normalized",
			type: "all",
		});
		expect(href).toContain("period=all");
	});

	it("treats a bare /statistics as pristine, so a default preset may apply", async () => {
		renderStatisticsRoute("/statistics");
		const { verdict } = await readProbe();
		expect(verdict).toBe(true);
	});

	it("treats a link spelling out only the defaults as pristine too", async () => {
		renderStatisticsRoute("/statistics?period=all&norm=normalized&type=all");
		const { verdict } = await readProbe();
		expect(verdict).toBe(true);
	});

	it("treats an explicit filter link as NOT pristine, protecting it from the default preset", async () => {
		renderStatisticsRoute("/statistics?type=tournament");
		const { raw, validated, verdict } = await readProbe();

		expect(raw).toMatchObject({ type: "tournament" });
		expect(validated).toMatchObject({ type: "tournament" });
		expect(verdict).toBe(false);
	});

	it("treats an explicit room link as NOT pristine", async () => {
		renderStatisticsRoute("/statistics?room=room-1");
		const { validated, verdict } = await readProbe();

		expect(validated).toMatchObject({ room: "room-1" });
		expect(verdict).toBe(false);
	});

	it("treats an empty-valued room param as pristine (?room= means no room)", async () => {
		renderStatisticsRoute("/statistics?room=");
		const { verdict } = await readProbe();
		expect(verdict).toBe(true);
	});
});
