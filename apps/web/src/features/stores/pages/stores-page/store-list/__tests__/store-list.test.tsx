import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const NEW_STORE_RE = /New store/i;

// StoreListCard renders a TanStack Router <Link> (needs router context), so stub
// the card module. StoreListCardSkeleton comes from the same module and is used
// by the loading branch, so stub it too. Its real shape is covered by
// store-list-card-skeleton.test.tsx.
vi.mock("@/features/stores/pages/stores-page/store-list-card", () => ({
	StoreListCard: ({ store }: { store: { id: string; name: string } }) => (
		<div data-store-id={store.id}>{store.name}</div>
	),
	StoreListCardSkeleton: () => <div data-testid="card-skeleton-stub" />,
}));

import { StoreList } from "@/features/stores/pages/stores-page/store-list/store-list";

const store = (id: string, name: string) => ({
	id,
	name,
	memo: null,
	ringGameCount: 0,
	tournamentCount: 0,
});

describe("StoreList", () => {
	describe("loading", () => {
		it("renders the skeleton (5 card skeletons) and neither cards nor empty state", () => {
			render(<StoreList isLoading onCreate={vi.fn()} stores={[]} />);
			const skeleton = screen.getByTestId("store-list-skeleton");
			expect(
				within(skeleton).getAllByTestId("card-skeleton-stub")
			).toHaveLength(5);
			expect(screen.queryByText("No stores yet")).not.toBeInTheDocument();
		});

		it("shows the skeleton while loading even if stores are already present", () => {
			render(
				<StoreList
					isLoading
					onCreate={vi.fn()}
					stores={[store("s1", "Akiba")]}
				/>
			);
			expect(screen.getByTestId("store-list-skeleton")).toBeInTheDocument();
			expect(screen.queryByText("Akiba")).not.toBeInTheDocument();
		});
	});

	describe("empty", () => {
		it("renders the empty-state heading, description, and CTA when not loading and no stores", () => {
			render(<StoreList isLoading={false} onCreate={vi.fn()} stores={[]} />);
			expect(screen.getByText("No stores yet")).toBeInTheDocument();
			expect(
				screen.getByText("Create your first store to start tracking its games.")
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: NEW_STORE_RE })
			).toBeInTheDocument();
			expect(
				screen.queryByTestId("store-list-skeleton")
			).not.toBeInTheDocument();
		});

		it("calls onCreate when the empty-state CTA is clicked", async () => {
			const user = userEvent.setup();
			const onCreate = vi.fn();
			render(<StoreList isLoading={false} onCreate={onCreate} stores={[]} />);
			await user.click(screen.getByRole("button", { name: NEW_STORE_RE }));
			expect(onCreate).toHaveBeenCalledTimes(1);
		});
	});

	describe("data", () => {
		it("renders one card per store and no empty state", () => {
			render(
				<StoreList
					isLoading={false}
					onCreate={vi.fn()}
					stores={[store("s1", "Akiba"), store("s2", "Shinjuku")]}
				/>
			);
			expect(screen.getByText("Akiba")).toBeInTheDocument();
			expect(screen.getByText("Shinjuku")).toBeInTheDocument();
			expect(screen.queryByText("No stores yet")).not.toBeInTheDocument();
			expect(
				screen.queryByTestId("store-list-skeleton")
			).not.toBeInTheDocument();
		});
	});
});
