import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../player-list-card", () => ({
	PlayerListCard: ({ player }: { player: { id: string; name: string } }) => (
		<div data-testid="player-card">{player.name}</div>
	),
	PlayerListCardSkeleton: () => <div data-testid="player-skeleton" />,
}));

import { PlayerList } from "@/features/players/pages/players-page/player-list/player-list";

const NEW_PLAYER_RE = /New player/i;

function makePlayer(id: string, name: string) {
	return { id, name, memo: null, tags: [] };
}

describe("PlayerList", () => {
	describe("loading branch", () => {
		it("renders the skeleton stack when isLoading is true", () => {
			render(
				<PlayerList
					isLoading
					isSearching={false}
					onCreate={vi.fn()}
					players={[]}
				/>
			);
			expect(screen.getByTestId("player-list-skeleton")).toBeInTheDocument();
			expect(screen.getAllByTestId("player-skeleton")).toHaveLength(5);
		});

		it("does not render cards or empty state while loading", () => {
			render(
				<PlayerList
					isLoading
					isSearching={false}
					onCreate={vi.fn()}
					players={[makePlayer("p1", "Alice")]}
				/>
			);
			expect(screen.queryByTestId("player-card")).not.toBeInTheDocument();
			expect(screen.queryByText("No players yet")).not.toBeInTheDocument();
		});
	});

	describe("empty branch (no filter)", () => {
		it("shows the 'No players yet' empty state with a create CTA", () => {
			render(
				<PlayerList
					isLoading={false}
					isSearching={false}
					onCreate={vi.fn()}
					players={[]}
				/>
			);
			expect(screen.getByText("No players yet")).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: NEW_PLAYER_RE })
			).toBeInTheDocument();
		});

		it("calls onCreate when the empty-state CTA is clicked", async () => {
			const user = userEvent.setup();
			const onCreate = vi.fn();
			render(
				<PlayerList
					isLoading={false}
					isSearching={false}
					onCreate={onCreate}
					players={[]}
				/>
			);
			await user.click(screen.getByRole("button", { name: NEW_PLAYER_RE }));
			expect(onCreate).toHaveBeenCalledTimes(1);
		});
	});

	describe("empty branch (searching)", () => {
		it("shows the no-match empty state without a CTA", () => {
			render(
				<PlayerList
					isLoading={false}
					isSearching
					onCreate={vi.fn()}
					players={[]}
				/>
			);
			expect(
				screen.getByText("No players match your search")
			).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: NEW_PLAYER_RE })
			).not.toBeInTheDocument();
		});
	});

	describe("data branch", () => {
		it("renders one card per player", () => {
			render(
				<PlayerList
					isLoading={false}
					isSearching={false}
					onCreate={vi.fn()}
					players={[makePlayer("p1", "Alice"), makePlayer("p2", "Bob")]}
				/>
			);
			const cards = screen.getAllByTestId("player-card");
			expect(cards).toHaveLength(2);
			expect(cards[0]).toHaveTextContent("Alice");
			expect(cards[1]).toHaveTextContent("Bob");
		});

		it("does not render the empty state when players are present", () => {
			render(
				<PlayerList
					isLoading={false}
					isSearching={false}
					onCreate={vi.fn()}
					players={[makePlayer("p1", "Alice")]}
				/>
			);
			expect(screen.queryByText("No players yet")).not.toBeInTheDocument();
			expect(
				screen.queryByText("No players match your search")
			).not.toBeInTheDocument();
		});
	});
});
it("shows a retryable initial-load error instead of the empty state", async () => {
	const user = userEvent.setup();
	const onRetry = vi.fn();
	render(
		<PlayerList
			isInitialLoadError
			isLoading={false}
			isSearching={false}
			onCreate={vi.fn()}
			onRetry={onRetry}
			players={[]}
		/>
	);
	expect(screen.getByRole("alert")).toHaveTextContent("Unable to load players");
	expect(screen.queryByText("No players yet")).not.toBeInTheDocument();
	await user.click(screen.getByRole("button", { name: "Retry" }));
	expect(onRetry).toHaveBeenCalledTimes(1);
});

it("keeps cached players visible when a later fetch has failed", () => {
	render(
		<PlayerList
			isInitialLoadError={false}
			isLoading={false}
			isSearching={false}
			onCreate={vi.fn()}
			onRetry={vi.fn()}
			players={[makePlayer("cached", "Cached player")]}
		/>
	);

	expect(screen.getByTestId("player-card")).toHaveTextContent("Cached player");
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
