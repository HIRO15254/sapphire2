import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CurrencyBalanceHero } from "@/features/currencies/v2/components/currency-balance-hero";

describe("CurrencyBalanceHero", () => {
	it("renders the Balance label and the compact value", () => {
		render(<CurrencyBalanceHero balance={1234} />);
		expect(screen.getByText("Balance")).toBeInTheDocument();
		expect(screen.getByText("1,234")).toBeInTheDocument();
	});

	it("shows the exact value line only when the value is abbreviated", () => {
		render(<CurrencyBalanceHero balance={100_000} />);
		expect(screen.getByText("100k")).toBeInTheDocument();
		expect(screen.getByText("100,000")).toBeInTheDocument();
	});

	it("omits the exact value line for a non-abbreviated value", () => {
		render(<CurrencyBalanceHero balance={500} />);
		// "500" is the compact value; there must be no second grouped line.
		expect(screen.getAllByText("500")).toHaveLength(1);
	});

	it("renders the unit beside the value when provided", () => {
		render(<CurrencyBalanceHero balance={1234} unit="pt" />);
		expect(screen.getByText("pt")).toBeInTheDocument();
	});

	it("does not render a unit when unit is null", () => {
		render(<CurrencyBalanceHero balance={1234} unit={null} />);
		expect(screen.queryByText("pt")).not.toBeInTheDocument();
	});

	it("appends the unit to the exact line when both are present", () => {
		render(<CurrencyBalanceHero balance={10_000} unit="pt" />);
		expect(screen.getByText("10,000 pt")).toBeInTheDocument();
	});

	it("colors a negative balance with the destructive token", () => {
		render(<CurrencyBalanceHero balance={-100} />);
		expect(screen.getByText("-100")).toHaveClass("text-destructive");
	});

	it("leaves a positive balance neutral (no destructive token)", () => {
		render(<CurrencyBalanceHero balance={100} />);
		expect(screen.getByText("100")).not.toHaveClass("text-destructive");
	});
});
