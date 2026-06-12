import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const NEW_STORE_RE = /New room/i;

// RoomListCard renders a TanStack Router <Link> (needs router context), so stub
// the card module. RoomListCardSkeleton comes from the same module and is used
// by the loading branch, so stub it too. Its real shape is covered by
// room-list-card-skeleton.test.tsx.
vi.mock("@/features/rooms/pages/rooms-page/room-list-card", () => ({
	RoomListCard: ({
		room,
		onToggleFavorite,
	}: {
		room: { id: string; name: string };
		onToggleFavorite: () => void;
	}) => (
		<div data-room-id={room.id}>
			{room.name}
			<button onClick={onToggleFavorite} type="button">
				toggle-fav
			</button>
		</div>
	),
	RoomListCardSkeleton: () => <div data-testid="card-skeleton-stub" />,
}));

import { RoomList } from "@/features/rooms/pages/rooms-page/room-list/room-list";

const room = (id: string, name: string) => ({
	id,
	name,
	isFavorite: false,
	memo: null,
	ringGameCount: 0,
	tournamentCount: 0,
});

describe("RoomList", () => {
	describe("loading", () => {
		it("renders the skeleton (5 card skeletons) and neither cards nor empty state", () => {
			render(
				<RoomList
					isLoading
					onCreate={vi.fn()}
					onToggleFavorite={vi.fn()}
					rooms={[]}
				/>
			);
			const skeleton = screen.getByTestId("room-list-skeleton");
			expect(
				within(skeleton).getAllByTestId("card-skeleton-stub")
			).toHaveLength(5);
			expect(screen.queryByText("No rooms yet")).not.toBeInTheDocument();
		});

		it("shows the skeleton while loading even if rooms are already present", () => {
			render(
				<RoomList
					isLoading
					onCreate={vi.fn()}
					onToggleFavorite={vi.fn()}
					rooms={[room("s1", "Akiba")]}
				/>
			);
			expect(screen.getByTestId("room-list-skeleton")).toBeInTheDocument();
			expect(screen.queryByText("Akiba")).not.toBeInTheDocument();
		});
	});

	describe("empty", () => {
		it("renders the empty-state heading, description, and CTA when not loading and no rooms", () => {
			render(
				<RoomList
					isLoading={false}
					onCreate={vi.fn()}
					onToggleFavorite={vi.fn()}
					rooms={[]}
				/>
			);
			expect(screen.getByText("No rooms yet")).toBeInTheDocument();
			expect(
				screen.getByText("Create your first room to start tracking its games.")
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: NEW_STORE_RE })
			).toBeInTheDocument();
			expect(
				screen.queryByTestId("room-list-skeleton")
			).not.toBeInTheDocument();
		});

		it("calls onCreate when the empty-state CTA is clicked", async () => {
			const user = userEvent.setup();
			const onCreate = vi.fn();
			render(
				<RoomList
					isLoading={false}
					onCreate={onCreate}
					onToggleFavorite={vi.fn()}
					rooms={[]}
				/>
			);
			await user.click(screen.getByRole("button", { name: NEW_STORE_RE }));
			expect(onCreate).toHaveBeenCalledTimes(1);
		});
	});

	describe("data", () => {
		it("renders one card per room and no empty state", () => {
			render(
				<RoomList
					isLoading={false}
					onCreate={vi.fn()}
					onToggleFavorite={vi.fn()}
					rooms={[room("s1", "Akiba"), room("s2", "Shinjuku")]}
				/>
			);
			expect(screen.getByText("Akiba")).toBeInTheDocument();
			expect(screen.getByText("Shinjuku")).toBeInTheDocument();
			expect(screen.queryByText("No rooms yet")).not.toBeInTheDocument();
			expect(
				screen.queryByTestId("room-list-skeleton")
			).not.toBeInTheDocument();
		});

		it("calls onToggleFavorite with the correct room id when toggle-fav is clicked", async () => {
			const user = userEvent.setup();
			const onToggleFavorite = vi.fn();
			render(
				<RoomList
					isLoading={false}
					onCreate={vi.fn()}
					onToggleFavorite={onToggleFavorite}
					rooms={[room("s1", "Akiba"), room("s2", "Shinjuku")]}
				/>
			);
			const toggleBtns = screen.getAllByRole("button", { name: "toggle-fav" });
			await user.click(toggleBtns[1]);
			expect(onToggleFavorite).toHaveBeenCalledTimes(1);
			expect(onToggleFavorite).toHaveBeenCalledWith("s2");
		});
	});
});
