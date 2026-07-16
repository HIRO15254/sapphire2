import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SessionResultChartImpl from "../session-result-chart-impl";

const CASH_GAME_CHART_NAME = /Cash game result chart/;
const TOURNAMENT_CHART_NAME = /Tournament result chart/;

describe("SessionResultChartImpl", () => {
	it("provides a text alternative listing cash chart series and data-point count", () => {
		render(
			<SessionResultChartImpl
				points={[
					{ t: 0, pl: 0, evPl: 0 },
					{ t: 60_000, pl: 1000, evPl: 900 },
				]}
				sessionType="cash_game"
			/>
		);

		expect(screen.getByText(CASH_GAME_CHART_NAME)).toHaveTextContent(
			"P&L and EV P&L series with 2 data points"
		);
	});

	it("provides a text alternative listing all tournament series and data-point count", () => {
		render(
			<SessionResultChartImpl
				points={[
					{ t: 0, stack: 5000, averageStack: 4000 },
					{ t: 60_000, stack: 6000, averageStack: 4500 },
					{ t: 120_000, stack: 7000, averageStack: 5000 },
				]}
				sessionType="tournament"
			/>
		);

		expect(screen.getByText(TOURNAMENT_CHART_NAME)).toHaveTextContent(
			"Stack and Avg stack series with 3 data points"
		);
	});

	it("summarizes only the Stack series when average stack is absent", () => {
		render(
			<SessionResultChartImpl
				points={[
					{ t: 0, stack: 5000, averageStack: null },
					{ t: 60_000, stack: 6000, averageStack: null },
				]}
				sessionType="tournament"
			/>
		);

		expect(screen.getByText(TOURNAMENT_CHART_NAME)).toHaveTextContent(
			"Stack series with 2 data points"
		);
	});
});
