import {
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CurrencyListCard } from "@/features/currencies/pages/currencies-page/currency-list-card";

// biome-ignore lint/suspicious/noEmptyBlockStatements: test helper
const noop = () => {};

function renderCard(
	currency: React.ComponentProps<typeof CurrencyListCard>["currency"],
	onToggleFavorite = noop
) {
	const rootRoute = createRootRoute({
		component: () => (
			<CurrencyListCard
				currency={currency}
				onToggleFavorite={onToggleFavorite}
			/>
		),
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
		renderCard({
			id: "c1",
			name: "Chips",
			unit: "USD",
			balance: 1234,
			isFavorite: false,
		});
		expect(await screen.findByText("Chips")).toBeInTheDocument();
		expect(screen.getByText("1,234")).toBeInTheDocument();
	});

	it("renders the unit as a suffix to the balance when present", async () => {
		renderCard({
			id: "c1",
			name: "Chips",
			unit: "USD",
			balance: 1234,
			isFavorite: false,
		});
		expect(await screen.findByText("1,234")).toBeInTheDocument();
		expect(screen.getByText("USD")).toBeInTheDocument();
	});

	it("omits the unit suffix when unit is null", async () => {
		renderCard({
			id: "c1",
			name: "Chips",
			unit: null,
			balance: 0,
			isFavorite: false,
		});
		expect(await screen.findByText("Chips")).toBeInTheDocument();
		expect(screen.queryByText("USD")).not.toBeInTheDocument();
	});

	it("omits the unit suffix when unit is the empty string", async () => {
		renderCard({
			id: "c1",
			name: "Chips",
			unit: "",
			balance: 0,
			isFavorite: false,
		});
		expect(await screen.findByText("Chips")).toBeInTheDocument();
		expect(screen.queryByText("USD")).not.toBeInTheDocument();
	});

	it("renders a link to the currency's detail route with the id param", async () => {
		renderCard({
			id: "c42",
			name: "Chips",
			unit: null,
			balance: 0,
			isFavorite: false,
		});
		const link = await screen.findByRole("link");
		expect(link).toHaveAttribute("href", "/currencies/c42");
	});

	it("uses compact notation for balances at the 10k boundary", async () => {
		renderCard({
			id: "c1",
			name: "Chips",
			unit: null,
			balance: 10_000,
			isFavorite: false,
		});
		expect(await screen.findByText("10k")).toBeInTheDocument();
	});

	it("renders 0 as plain '0' without compaction", async () => {
		renderCard({
			id: "c1",
			name: "Chips",
			unit: null,
			balance: 0,
			isFavorite: false,
		});
		expect(await screen.findByText("0")).toBeInTheDocument();
	});

	it("renders negative balances with their native sign", async () => {
		renderCard({
			id: "c1",
			name: "Chips",
			unit: null,
			balance: -500,
			isFavorite: false,
		});
		expect(await screen.findByText("-500")).toBeInTheDocument();
	});

	describe("favorite star", () => {
		it("renders a star button with aria-label 'Add to favorites' when isFavorite is false", async () => {
			renderCard({
				id: "c1",
				name: "Chips",
				unit: null,
				balance: 0,
				isFavorite: false,
			});
			const btn = await screen.findByRole("button", {
				name: "Add to favorites",
			});
			expect(btn).toBeInTheDocument();
		});

		it("renders a star button with aria-label 'Remove from favorites' when isFavorite is true", async () => {
			renderCard({
				id: "c1",
				name: "Chips",
				unit: null,
				balance: 0,
				isFavorite: true,
			});
			const btn = await screen.findByRole("button", {
				name: "Remove from favorites",
			});
			expect(btn).toBeInTheDocument();
		});

		it("calls onToggleFavorite when the star button is clicked", async () => {
			const handler = vi.fn();
			renderCard(
				{ id: "c1", name: "Chips", unit: null, balance: 0, isFavorite: false },
				handler
			);
			const btn = await screen.findByRole("button", {
				name: "Add to favorites",
			});
			btn.click();
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it("does not navigate to detail page when the star button is clicked", async () => {
			const handler = vi.fn();
			renderCard(
				{ id: "c1", name: "Chips", unit: null, balance: 0, isFavorite: false },
				handler
			);
			const btn = await screen.findByRole("button", {
				name: "Add to favorites",
			});
			const link = screen.getByRole("link");
			const href = link.getAttribute("href");
			btn.click();
			// The link's href must not change — we navigated nowhere.
			expect(link).toHaveAttribute("href", href);
		});
	});
});
