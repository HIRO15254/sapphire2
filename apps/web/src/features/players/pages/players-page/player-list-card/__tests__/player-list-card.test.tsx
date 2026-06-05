import {
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlayerListCard } from "@/features/players/pages/players-page/player-list-card";

const OVERFLOW_RE = /^\+\d+$/;

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

function tag(id: string, name: string) {
	return { id, name, color: "blue" };
}

const basePlayer = {
	id: "p1",
	name: "Alice",
	tags: [] as Array<{ color: string; id: string; name: string }>,
};

describe("PlayerListCard", () => {
	it("renders the player name", async () => {
		renderCard(basePlayer);
		expect(await screen.findByText("Alice")).toBeInTheDocument();
	});

	it("renders every tag inline when within the visible limit", async () => {
		renderCard({
			...basePlayer,
			tags: [tag("vip", "VIP"), tag("reg", "Regular")],
		});
		await screen.findByText("Alice");
		expect(screen.getByText("VIP")).toBeInTheDocument();
		expect(screen.getByText("Regular")).toBeInTheDocument();
		expect(screen.queryByText(OVERFLOW_RE)).not.toBeInTheDocument();
	});

	it("collapses tags beyond the limit into a +N badge", async () => {
		renderCard({
			...basePlayer,
			tags: [
				tag("vip", "VIP"),
				tag("reg", "Regular"),
				tag("fish", "Fish"),
				tag("whale", "Whale"),
			],
		});
		await screen.findByText("Alice");
		// First two tags stay visible, the remaining two collapse to "+2".
		expect(screen.getByText("VIP")).toBeInTheDocument();
		expect(screen.getByText("Regular")).toBeInTheDocument();
		expect(screen.getByText("+2")).toBeInTheDocument();
		expect(screen.queryByText("Fish")).not.toBeInTheDocument();
		expect(screen.queryByText("Whale")).not.toBeInTheDocument();
	});

	it("shows +1 when exactly one tag overflows", async () => {
		renderCard({
			...basePlayer,
			tags: [tag("vip", "VIP"), tag("reg", "Regular"), tag("fish", "Fish")],
		});
		await screen.findByText("Alice");
		expect(screen.getByText("+1")).toBeInTheDocument();
		expect(screen.queryByText("Fish")).not.toBeInTheDocument();
	});

	it("renders no tag cluster when the player has no tags", async () => {
		renderCard(basePlayer);
		await screen.findByText("Alice");
		expect(screen.queryByText("VIP")).not.toBeInTheDocument();
		expect(screen.queryByText(OVERFLOW_RE)).not.toBeInTheDocument();
	});

	it("links to the player's detail route with the id param", async () => {
		renderCard({ ...basePlayer, id: "p42" });
		const link = await screen.findByRole("link");
		expect(link).toHaveAttribute("href", "/players/p42");
	});

	it("keeps a fixed single-row height regardless of tags", async () => {
		renderCard(basePlayer);
		const bare = await screen.findByRole("link");
		expect(bare).toHaveClass("h-14");

		renderCard({
			...basePlayer,
			tags: [tag("vip", "VIP"), tag("reg", "Regular"), tag("fish", "Fish")],
		});
		const links = await screen.findAllByRole("link");
		// Every card row carries the same fixed-height class, with or without tags.
		for (const link of links) {
			expect(link).toHaveClass("h-14");
		}
	});
});
