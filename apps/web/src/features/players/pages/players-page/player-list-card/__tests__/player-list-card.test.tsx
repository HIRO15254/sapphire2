import {
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlayerListCard } from "@/features/players/pages/players-page/player-list-card";

function renderCard(
	player: React.ComponentProps<typeof PlayerListCard>["player"]
) {
	const rootRoute = createRootRoute({
		component: () => <PlayerListCard player={player} />,
	});
	const detailRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/players/$playerId",
		component: () => <div>detail</div>,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([detailRoute]),
	});
	return render(<RouterProvider router={router} />);
}

const basePlayer = {
	id: "p1",
	name: "Alice",
	memo: null as string | null,
	tags: [] as Array<{ color: string; id: string; name: string }>,
};

describe("PlayerListCard", () => {
	it("renders the player name", async () => {
		renderCard(basePlayer);
		expect(await screen.findByText("Alice")).toBeInTheDocument();
	});

	it("renders each tag name", async () => {
		renderCard({
			...basePlayer,
			tags: [
				{ id: "vip", name: "VIP", color: "blue" },
				{ id: "reg", name: "Regular", color: "red" },
			],
		});
		await screen.findByText("Alice");
		expect(screen.getByText("VIP")).toBeInTheDocument();
		expect(screen.getByText("Regular")).toBeInTheDocument();
	});

	it("shows the memo indicator when a memo is present", async () => {
		renderCard({ ...basePlayer, memo: "Tough regular" });
		expect(await screen.findByLabelText("Has memo")).toBeInTheDocument();
	});

	it("omits the memo indicator when memo is null", async () => {
		renderCard({ ...basePlayer, memo: null });
		await screen.findByText("Alice");
		expect(screen.queryByLabelText("Has memo")).not.toBeInTheDocument();
	});

	it("omits the memo indicator when memo is an empty string", async () => {
		renderCard({ ...basePlayer, memo: "" });
		await screen.findByText("Alice");
		expect(screen.queryByLabelText("Has memo")).not.toBeInTheDocument();
	});

	it("links to the player's detail route with the id param", async () => {
		renderCard({ ...basePlayer, id: "p42" });
		const link = await screen.findByRole("link");
		expect(link).toHaveAttribute("href", "/players/p42");
	});

	it("keeps a fixed row height regardless of tags or memo", async () => {
		renderCard(basePlayer);
		const bare = await screen.findByRole("link");
		expect(bare).toHaveClass("h-16");

		renderCard({
			...basePlayer,
			memo: "<p>note</p>",
			tags: [{ id: "vip", name: "VIP", color: "blue" }],
		});
		const links = await screen.findAllByRole("link");
		// Every card row carries the same fixed-height class, with or without
		// tags/memo — the row never grows to fit its content.
		for (const link of links) {
			expect(link).toHaveClass("h-16");
		}
	});
});
