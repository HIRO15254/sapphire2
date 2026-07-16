import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BreakdownViewRow } from "@/features/statistics/pages/statistics-page/breakdown-section/use-breakdown-section";
import { BreakdownTable } from "../breakdown-table";

const ROWS: BreakdownViewRow[] = [
	{
		cashColor: "",
		cashText: "—",
		key: "mix",
		label: "Mixed Game",
		netColor: "text-emerald-600",
		netText: "+1,500 USD",
		playTimeText: "2h",
		sessions: 1,
		tournamentColor: "",
		tournamentText: "—",
		virtualWinRateText: "40.0%",
	},
	{
		cashColor: "text-emerald-600",
		cashText: "+30 bb",
		key: "holdem",
		label: "NL Hold'em",
		netColor: "text-emerald-600",
		netText: "+300 USD",
		playTimeText: "1h",
		sessions: 2,
		tournamentColor: "",
		tournamentText: "—",
		virtualWinRateText: "75.0%",
	},
];

describe("BreakdownTable", () => {
	it("shows raw Net beside normalized columns when some rows cannot be normalized", () => {
		render(
			<BreakdownTable
				normalized
				rows={ROWS}
				showCashColumn
				showNetColumn
				showTournamentColumn={false}
			/>
		);

		expect(
			screen.getAllByRole("columnheader").map((header) => header.textContent)
		).toEqual(["Group", "Sessions", "Net", "BB", "Virtual WR", "Play time"]);
		const mixRow = screen.getByText("Mixed Game").closest("tr");
		expect(mixRow).not.toBeNull();
		expect(
			within(mixRow as HTMLTableRowElement).getByText("+1,500 USD")
		).toBeVisible();
		expect(within(mixRow as HTMLTableRowElement).getByText("—")).toBeVisible();
	});

	it("omits raw Net when every row has a normalized value", () => {
		render(
			<BreakdownTable
				normalized
				rows={[ROWS[1]]}
				showCashColumn
				showNetColumn={false}
				showTournamentColumn={false}
			/>
		);

		expect(
			screen.getAllByRole("columnheader").map((header) => header.textContent)
		).toEqual(["Group", "Sessions", "BB", "Virtual WR", "Play time"]);
		expect(screen.queryByText("+300 USD")).not.toBeInTheDocument();
	});

	it("renders each row's virtual win rate in the Virtual WR column", () => {
		render(
			<BreakdownTable
				normalized={false}
				rows={ROWS}
				showCashColumn={false}
				showNetColumn={false}
				showTournamentColumn={false}
			/>
		);

		const mixRow = screen.getByText("Mixed Game").closest("tr");
		expect(
			within(mixRow as HTMLTableRowElement).getByText("40.0%")
		).toBeVisible();
		const holdemRow = screen.getByText("NL Hold'em").closest("tr");
		expect(
			within(holdemRow as HTMLTableRowElement).getByText("75.0%")
		).toBeVisible();
	});

	it("spans every visible column in the empty state", () => {
		render(
			<BreakdownTable
				normalized={false}
				rows={[]}
				showCashColumn={false}
				showNetColumn={false}
				showTournamentColumn={false}
			/>
		);

		expect(screen.getByText("No data")).toHaveAttribute("colspan", "5");
	});
});
