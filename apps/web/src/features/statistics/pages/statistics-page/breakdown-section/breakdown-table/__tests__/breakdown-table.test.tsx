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
		).toEqual(["Group", "Sessions", "Net", "BB", "Play time"]);
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
		).toEqual(["Group", "Sessions", "BB", "Play time"]);
		expect(screen.queryByText("+300 USD")).not.toBeInTheDocument();
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

		expect(screen.getByText("No data")).toHaveAttribute("colspan", "4");
	});
});
