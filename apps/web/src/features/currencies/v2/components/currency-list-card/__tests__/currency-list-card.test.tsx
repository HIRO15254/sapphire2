import {
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CurrencyListCard } from "@/features/currencies/v2/components/currency-list-card";

function renderCard(
	currency: React.ComponentProps<typeof CurrencyListCard>["currency"]
) {
	const rootRoute = createRootRoute({
		component: () => <CurrencyListCard currency={currency} />,
	});
	const detailRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/currencies/$currencyId",
		component: () => <div>detail</div>,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([detailRoute]),
	});
	return render(<RouterProvider router={router} />);
}

describe("CurrencyListCard", () => {
	it("renders the currency name and balance", async () => {
		renderCard({ id: "c1", name: "Chips", unit: "USD", balance: 1234 });
		expect(await screen.findByText("Chips")).toBeInTheDocument();
		expect(screen.getByText("1,234")).toBeInTheDocument();
	});

	it("renders the unit as a suffix to the balance when present", async () => {
		renderCard({ id: "c1", name: "Chips", unit: "USD", balance: 1234 });
		expect(await screen.findByText("1,234")).toBeInTheDocument();
		expect(screen.getByText("USD")).toBeInTheDocument();
	});

	it("omits the unit suffix when unit is null", async () => {
		renderCard({ id: "c1", name: "Chips", unit: null, balance: 0 });
		expect(await screen.findByText("Chips")).toBeInTheDocument();
		expect(screen.queryByText("USD")).not.toBeInTheDocument();
	});

	it("omits the unit suffix when unit is the empty string", async () => {
		renderCard({ id: "c1", name: "Chips", unit: "", balance: 0 });
		expect(await screen.findByText("Chips")).toBeInTheDocument();
		expect(screen.queryByText("USD")).not.toBeInTheDocument();
	});

	it("renders a link to the currency's detail route with the id param", async () => {
		renderCard({ id: "c42", name: "Chips", unit: null, balance: 0 });
		const link = await screen.findByRole("link");
		expect(link).toHaveAttribute("href", "/currencies/c42");
	});

	it("uses compact notation for balances at the 10k boundary", async () => {
		renderCard({ id: "c1", name: "Chips", unit: null, balance: 10_000 });
		expect(await screen.findByText("10k")).toBeInTheDocument();
	});

	it("renders 0 as plain '0' without compaction", async () => {
		renderCard({ id: "c1", name: "Chips", unit: null, balance: 0 });
		expect(await screen.findByText("0")).toBeInTheDocument();
	});

	it("renders negative balances with their native sign", async () => {
		renderCard({ id: "c1", name: "Chips", unit: null, balance: -500 });
		expect(await screen.findByText("-500")).toBeInTheDocument();
	});
});
