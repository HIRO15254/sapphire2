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

/**
 * Pins the router behaviour the statistics default-preset feature depends on,
 * against a REAL router — every other test in this area mocks
 * `@tanstack/react-router` wholesale, which is exactly how the original
 * implementation shipped broken.
 *
 * The rule this proves: on a route with `validateSearch`, TanStack Router bakes
 * the schema's defaults into `location.search` **and rewrites the URL to match**.
 * So "is this a bare `/statistics` load?" cannot be answered by inspecting the
 * router's search object — it always carries `period` / `norm` / `type`. The
 * first implementation of this gate did exactly that
 * (`Object.keys(location.search).length === 0`) and was therefore permanently
 * false, silently disabling the statistics default preset with every unit test
 * still green.
 *
 * `useStatsFilters` now derives the verdict from the FILTER VALUES instead
 * (`isDefaultStatsFilterState`), so this file asserts both halves: the router
 * behaviour that rules the old approach out, and that the new predicate answers
 * correctly for each of these real navigations.
 */

/** Renders both views of the search params so each test can compare them. */
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

		// This is why a "raw search is empty" check cannot work on this route.
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
