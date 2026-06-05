import {
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoomListCard } from "@/features/rooms/pages/rooms-page/room-list-card";

function renderCard(room: React.ComponentProps<typeof RoomListCard>["room"]) {
	const rootRoute = createRootRoute({
		component: () => <RoomListCard room={room} />,
	});
	const detailRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/rooms/$roomId",
		component: () => <div>detail</div>,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([detailRoute]),
	});
	return render(<RouterProvider router={router} />);
}

const baseRoom = {
	id: "s1",
	name: "Akiba Casino",
	memo: null as string | null,
	ringGameCount: 0,
	tournamentCount: 0,
};

describe("RoomListCard", () => {
	it("renders the room name", async () => {
		renderCard(baseRoom);
		expect(await screen.findByText("Akiba Casino")).toBeInTheDocument();
	});

	it("renders the memo when present", async () => {
		renderCard({ ...baseRoom, memo: "weekly visits" });
		expect(await screen.findByText("weekly visits")).toBeInTheDocument();
	});

	it("omits the memo line when memo is null", async () => {
		renderCard({ ...baseRoom, memo: null });
		await screen.findByText("Akiba Casino");
		expect(screen.queryByText("weekly visits")).not.toBeInTheDocument();
	});

	it("renders the cash game count", async () => {
		renderCard({ ...baseRoom, ringGameCount: 3 });
		await screen.findByText("Akiba Casino");
		expect(screen.getByLabelText("Cash games")).toHaveTextContent("3");
	});

	it("renders the tournament count", async () => {
		renderCard({ ...baseRoom, tournamentCount: 5 });
		await screen.findByText("Akiba Casino");
		expect(screen.getByLabelText("Tournaments")).toHaveTextContent("5");
	});

	it("renders zero counts", async () => {
		renderCard({ ...baseRoom, ringGameCount: 0, tournamentCount: 0 });
		await screen.findByText("Akiba Casino");
		expect(screen.getByLabelText("Cash games")).toHaveTextContent("0");
		expect(screen.getByLabelText("Tournaments")).toHaveTextContent("0");
	});

	it("links to the room's detail route with the id param", async () => {
		renderCard({ ...baseRoom, id: "s42" });
		const link = await screen.findByRole("link");
		expect(link).toHaveAttribute("href", "/rooms/s42");
	});
});
