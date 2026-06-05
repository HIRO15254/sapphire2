import {
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StoreListCard } from "@/features/stores/pages/stores-page/store-list-card";

function renderCard(
	store: React.ComponentProps<typeof StoreListCard>["store"]
) {
	const rootRoute = createRootRoute({
		component: () => <StoreListCard store={store} />,
	});
	const detailRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/stores/$storeId",
		component: () => <div>detail</div>,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([detailRoute]),
	});
	return render(<RouterProvider router={router} />);
}

const baseStore = {
	id: "s1",
	name: "Akiba Casino",
	memo: null as string | null,
	ringGameCount: 0,
	tournamentCount: 0,
};

describe("StoreListCard", () => {
	it("renders the store name", async () => {
		renderCard(baseStore);
		expect(await screen.findByText("Akiba Casino")).toBeInTheDocument();
	});

	it("renders the memo when present", async () => {
		renderCard({ ...baseStore, memo: "weekly visits" });
		expect(await screen.findByText("weekly visits")).toBeInTheDocument();
	});

	it("omits the memo line when memo is null", async () => {
		renderCard({ ...baseStore, memo: null });
		await screen.findByText("Akiba Casino");
		expect(screen.queryByText("weekly visits")).not.toBeInTheDocument();
	});

	it("renders the cash game count", async () => {
		renderCard({ ...baseStore, ringGameCount: 3 });
		await screen.findByText("Akiba Casino");
		expect(screen.getByLabelText("Cash games")).toHaveTextContent("3");
	});

	it("renders the tournament count", async () => {
		renderCard({ ...baseStore, tournamentCount: 5 });
		await screen.findByText("Akiba Casino");
		expect(screen.getByLabelText("Tournaments")).toHaveTextContent("5");
	});

	it("renders zero counts", async () => {
		renderCard({ ...baseStore, ringGameCount: 0, tournamentCount: 0 });
		await screen.findByText("Akiba Casino");
		expect(screen.getByLabelText("Cash games")).toHaveTextContent("0");
		expect(screen.getByLabelText("Tournaments")).toHaveTextContent("0");
	});

	it("links to the store's detail route with the id param", async () => {
		renderCard({ ...baseStore, id: "s42" });
		const link = await screen.findByRole("link");
		expect(link).toHaveAttribute("href", "/stores/s42");
	});
});
