import {
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RoomListCard } from "@/features/rooms/pages/rooms-page/room-list-card";

function renderCard(
	room: React.ComponentProps<typeof RoomListCard>["room"],
	onToggleFavorite = vi.fn()
) {
	const rootRoute = createRootRoute({
		component: () => (
			<RoomListCard onToggleFavorite={onToggleFavorite} room={room} />
		),
	});
	const detailRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/rooms/$roomId",
		component: () => <div>detail</div>,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([detailRoute]),
	});
	return {
		rendered: render(<RouterProvider router={router} />),
		onToggleFavorite,
	};
}

const baseRoom = {
	id: "s1",
	name: "Akiba Casino",
	isFavorite: false,
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

	it("keeps the favorite button outside the detail link", async () => {
		renderCard(baseRoom);
		const link = await screen.findByRole("link");
		expect(link.querySelector("button")).toBeNull();
	});

	it("renders the 'Add to favorites' button when isFavorite is false", async () => {
		renderCard({ ...baseRoom, isFavorite: false });
		await screen.findByText("Akiba Casino");
		expect(screen.getByLabelText("Add to favorites")).toBeInTheDocument();
	});

	it("renders the 'Remove from favorites' button when isFavorite is true", async () => {
		renderCard({ ...baseRoom, isFavorite: true });
		await screen.findByText("Akiba Casino");
		expect(screen.getByLabelText("Remove from favorites")).toBeInTheDocument();
	});

	it("calls onToggleFavorite when the star button is clicked", async () => {
		const user = userEvent.setup();
		const { onToggleFavorite } = renderCard({ ...baseRoom, isFavorite: false });
		await screen.findByText("Akiba Casino");
		await user.click(screen.getByLabelText("Add to favorites"));
		expect(onToggleFavorite).toHaveBeenCalledTimes(1);
	});

	it("does not navigate when the star button is clicked (e.preventDefault)", async () => {
		const user = userEvent.setup();
		renderCard({ ...baseRoom, isFavorite: false });
		await screen.findByText("Akiba Casino");
		const starBtn = screen.getByLabelText("Add to favorites");
		await user.click(starBtn);
		expect(screen.queryByText("detail")).not.toBeInTheDocument();
	});
});
