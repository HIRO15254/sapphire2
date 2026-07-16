import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ItemHoldingsHero } from "@/features/items/pages/item-detail-page/item-holdings-hero";

describe("ItemHoldingsHero", () => {
	it("renders the Holdings label and the compact value", () => {
		render(<ItemHoldingsHero holdings={1234} unitValue={100} />);
		expect(screen.getByText("Holdings")).toBeInTheDocument();
		expect(screen.getByText("1,234")).toBeInTheDocument();
	});

	it("shows the exact value line only when the value is abbreviated", () => {
		render(<ItemHoldingsHero holdings={100_000} unitValue={100} />);
		expect(screen.getByText("100k")).toBeInTheDocument();
		expect(screen.getByText("100,000")).toBeInTheDocument();
	});

	it("omits the exact value line for a non-abbreviated value", () => {
		render(<ItemHoldingsHero holdings={500} unitValue={100} />);
		// "500" is the compact value; there must be no second grouped line.
		expect(screen.getAllByText("500")).toHaveLength(1);
	});

	it("shows the unit value with the currency unit and name", () => {
		render(
			<ItemHoldingsHero
				currencyName="USD"
				currencyUnit="$"
				holdings={3}
				unitValue={100}
			/>
		);
		expect(screen.getByText("Unit value 100 $ · USD")).toBeInTheDocument();
	});

	it("omits the currency name from the unit-value line when it is null", () => {
		render(
			<ItemHoldingsHero
				currencyName={null}
				currencyUnit="$"
				holdings={3}
				unitValue={100}
			/>
		);
		expect(screen.getByText("Unit value 100 $")).toBeInTheDocument();
	});

	it("omits the currency unit from the unit-value line when it is null", () => {
		render(
			<ItemHoldingsHero
				currencyName="USD"
				currencyUnit={null}
				holdings={3}
				unitValue={100}
			/>
		);
		expect(screen.getByText("Unit value 100 · USD")).toBeInTheDocument();
	});

	it("shows just the unit value when the currency name and unit are both absent", () => {
		render(<ItemHoldingsHero holdings={3} unitValue={100} />);
		expect(screen.getByText("Unit value 100")).toBeInTheDocument();
	});

	it("groups a large unit value with the shared locale-fixed formatter", () => {
		render(<ItemHoldingsHero holdings={3} unitValue={10_000} />);
		expect(screen.getByText("Unit value 10,000")).toBeInTheDocument();
	});

	it("colors negative holdings with the destructive token", () => {
		render(<ItemHoldingsHero holdings={-100} unitValue={0} />);
		expect(screen.getByText("-100")).toHaveClass("text-destructive");
	});

	it("leaves positive holdings neutral (no destructive token)", () => {
		render(<ItemHoldingsHero holdings={100} unitValue={0} />);
		expect(screen.getByText("100")).not.toHaveClass("text-destructive");
	});
});
