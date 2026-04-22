import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SessionSummary } from "./session-summary";

const baseSummary = {
	totalSessions: 10,
	totalProfitLoss: 25_000,
	winRate: 60,
	avgProfitLoss: 2500,
	avgPlacement: null,
	totalPrizeMoney: null,
	itmRate: null,
	totalEvProfitLoss: null,
	totalEvDiff: null,
};

describe("SessionSummary", () => {
	it("renders all basic metrics", () => {
		render(<SessionSummary summary={baseSummary} />);

		expect(screen.getByText("Total Sessions")).toBeInTheDocument();
		expect(screen.getByText("10")).toBeInTheDocument();
		expect(screen.getByText("Total P&L")).toBeInTheDocument();
		expect(screen.getByText("+25k")).toBeInTheDocument();
		expect(screen.getByText("Win Rate")).toBeInTheDocument();
		expect(screen.getByText("60.0%")).toBeInTheDocument();
		expect(screen.getByText("Avg P&L")).toBeInTheDocument();
		expect(screen.getByText("+2,500")).toBeInTheDocument();
	});

	it("renders nothing when totalSessions is 0", () => {
		const { container } = render(
			<SessionSummary summary={{ ...baseSummary, totalSessions: 0 }} />
		);

		expect(container.firstChild).toBeNull();
	});

	it("renders tournament-specific metrics when available", () => {
		render(
			<SessionSummary
				summary={{
					...baseSummary,
					avgPlacement: 5.2,
					totalPrizeMoney: 100_000,
					itmRate: 40,
				}}
			/>
		);

		expect(screen.getByText("Avg Placement")).toBeInTheDocument();
		expect(screen.getByText("5.2")).toBeInTheDocument();
		expect(screen.getByText("Total Prize")).toBeInTheDocument();
		expect(screen.getByText("100k")).toBeInTheDocument();
		expect(screen.getByText("ITM Rate")).toBeInTheDocument();
		expect(screen.getByText("40.0%")).toBeInTheDocument();
	});

	it("does not render tournament metrics when null", () => {
		render(<SessionSummary summary={baseSummary} />);

		expect(screen.queryByText("Avg Placement")).not.toBeInTheDocument();
		expect(screen.queryByText("Total Prize")).not.toBeInTheDocument();
		expect(screen.queryByText("ITM Rate")).not.toBeInTheDocument();
	});

	it("renders EV metrics when available", () => {
		render(
			<SessionSummary
				summary={{
					...baseSummary,
					totalEvProfitLoss: 15_000,
					totalEvDiff: -10_000,
				}}
			/>
		);

		expect(screen.getByText("Total EV P&L")).toBeInTheDocument();
		expect(screen.getByText("+15k")).toBeInTheDocument();
		expect(screen.getByText("Total EV Diff")).toBeInTheDocument();
		expect(screen.getByText("-10k")).toBeInTheDocument();
	});

	it("does not render EV metrics when null", () => {
		render(<SessionSummary summary={baseSummary} />);

		expect(screen.queryByText("Total EV P&L")).not.toBeInTheDocument();
		expect(screen.queryByText("Total EV Diff")).not.toBeInTheDocument();
	});

	it("applies correct color classes for negative P&L", () => {
		render(
			<SessionSummary summary={{ ...baseSummary, totalProfitLoss: -5000 }} />
		);

		const plValue = screen.getByText("-5,000");
		expect(plValue.className).toContain("text-red-600");
	});
});
