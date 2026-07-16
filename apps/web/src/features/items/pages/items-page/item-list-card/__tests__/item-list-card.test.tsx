import {
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ItemListCard } from "@/features/items/pages/items-page/item-list-card";

function renderCard(item: React.ComponentProps<typeof ItemListCard>["item"]) {
	const rootRoute = createRootRoute({
		component: () => <ItemListCard item={item} />,
	});
	const detailRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/items/$itemId",
		component: () => <div>detail</div>,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([detailRoute]),
	});
	return render(<RouterProvider router={router} />);
}

const baseItem = {
	currencyName: "USD" as string | null,
	currencyUnit: "$" as string | null,
	holdings: 3,
	id: "i1",
	name: "Ticket",
	unitValue: 100,
};

describe("ItemListCard", () => {
	it("renders the item name and holdings count", async () => {
		renderCard(baseItem);
		expect(await screen.findByText("Ticket")).toBeInTheDocument();
		expect(screen.getByText("3")).toBeInTheDocument();
	});

	it("renders the unit value with the currency unit and name on the meta line", async () => {
		renderCard(baseItem);
		expect(await screen.findByText("100 $ · USD")).toBeInTheDocument();
	});

	it("omits the currency name when it is null", async () => {
		renderCard({ ...baseItem, currencyName: null });
		expect(await screen.findByText("100 $")).toBeInTheDocument();
	});

	it("omits the currency unit when it is null", async () => {
		renderCard({ ...baseItem, currencyUnit: null });
		expect(await screen.findByText("100 · USD")).toBeInTheDocument();
	});

	it("shows just the unit value when both currency name and unit are null", async () => {
		renderCard({ ...baseItem, currencyName: null, currencyUnit: null });
		expect(await screen.findByText("100")).toBeInTheDocument();
	});

	it("renders a link to the item's detail route with the id param", async () => {
		renderCard({ ...baseItem, id: "i42" });
		const link = await screen.findByRole("link");
		expect(link).toHaveAttribute("href", "/items/i42");
	});

	it("uses compact notation for holdings at the 10k boundary", async () => {
		renderCard({ ...baseItem, holdings: 10_000 });
		expect(await screen.findByText("10k")).toBeInTheDocument();
	});

	it("renders zero holdings as plain '0' without compaction", async () => {
		renderCard({ ...baseItem, holdings: 0 });
		expect(await screen.findByText("0")).toBeInTheDocument();
	});

	it("renders negative holdings with their native sign", async () => {
		renderCard({ ...baseItem, holdings: -5 });
		expect(await screen.findByText("-5")).toBeInTheDocument();
	});

	it("labels the holdings value with a 'held' suffix", async () => {
		renderCard(baseItem);
		expect(await screen.findByText("held")).toBeInTheDocument();
	});

	it("compacts a large unit value on the meta line", async () => {
		renderCard({ ...baseItem, unitValue: 10_000 });
		expect(await screen.findByText("10k $ · USD")).toBeInTheDocument();
	});
});
