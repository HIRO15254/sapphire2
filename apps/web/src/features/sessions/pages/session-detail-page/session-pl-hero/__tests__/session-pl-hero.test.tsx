import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SessionPlHero } from "@/features/sessions/pages/session-detail-page/session-pl-hero";

const EV_PREFIX = /^EV/;

describe("SessionPlHero", () => {
	it("renders a positive P&L with a leading plus", () => {
		render(<SessionPlHero currencyUnit={null} profitLoss={1500} />);
		expect(screen.getByText("+1,500")).toBeInTheDocument();
	});

	it("renders a negative P&L", () => {
		render(<SessionPlHero currencyUnit={null} profitLoss={-2000} />);
		expect(screen.getByText("-2,000")).toBeInTheDocument();
	});

	it("renders zero when P&L is null", () => {
		render(<SessionPlHero currencyUnit={null} profitLoss={null} />);
		expect(screen.getByText("+0")).toBeInTheDocument();
	});

	it("appends the currency unit", () => {
		render(<SessionPlHero currencyUnit="$" profitLoss={1500} />);
		expect(screen.getByText("+1,500 $")).toBeInTheDocument();
	});

	it("shows the EV figure when provided", () => {
		render(
			<SessionPlHero currencyUnit={null} evProfitLoss={800} profitLoss={1500} />
		);
		expect(screen.getByText("+800")).toBeInTheDocument();
	});

	it("omits the EV figure when null", () => {
		render(
			<SessionPlHero
				currencyUnit={null}
				evProfitLoss={null}
				profitLoss={1500}
			/>
		);
		expect(screen.queryByText(EV_PREFIX)).not.toBeInTheDocument();
	});

	it("omits the EV figure when undefined", () => {
		render(<SessionPlHero currencyUnit={null} profitLoss={1500} />);
		expect(screen.queryByText(EV_PREFIX)).not.toBeInTheDocument();
	});
});
