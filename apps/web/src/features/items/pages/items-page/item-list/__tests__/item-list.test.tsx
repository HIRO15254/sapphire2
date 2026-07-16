import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const NEW_ITEM_RE = /New item/i;

// ItemListCard renders a TanStack Router <Link> (needs router context), so
// stub the card module. ItemListCardSkeleton comes from the same module and
// is used by the loading branch, so stub it too. Its real shape is covered by
// item-list-card-skeleton.test.tsx.
vi.mock("@/features/items/pages/items-page/item-list-card", () => ({
	ItemListCard: ({ item }: { item: { id: string; name: string } }) => (
		<div data-item-id={item.id}>
			<span>{item.name}</span>
		</div>
	),
	ItemListCardSkeleton: () => <div data-testid="card-skeleton-stub" />,
}));

import { ItemList } from "@/features/items/pages/items-page/item-list/item-list";

const item = (id: string, name: string) => ({
	currencyName: null,
	currencyUnit: null,
	holdings: 0,
	id,
	name,
	unitValue: 0,
});

describe("ItemList", () => {
	describe("loading", () => {
		it("renders the skeleton (5 card skeletons) and neither cards nor empty state", () => {
			render(<ItemList isLoading items={[]} onCreate={vi.fn()} />);
			const skeleton = screen.getByTestId("item-list-skeleton");
			expect(
				within(skeleton).getAllByTestId("card-skeleton-stub")
			).toHaveLength(5);
			expect(screen.queryByText("No items yet")).not.toBeInTheDocument();
		});

		it("shows the skeleton while loading even if items are already present", () => {
			render(
				<ItemList isLoading items={[item("i1", "Ticket")]} onCreate={vi.fn()} />
			);
			expect(screen.getByTestId("item-list-skeleton")).toBeInTheDocument();
			expect(screen.queryByText("Ticket")).not.toBeInTheDocument();
		});
	});

	describe("empty", () => {
		it("renders the empty-state heading, description, and CTA when not loading and no items", () => {
			render(<ItemList isLoading={false} items={[]} onCreate={vi.fn()} />);
			expect(screen.getByText("No items yet")).toBeInTheDocument();
			expect(
				screen.getByText(
					"Create your first item to track tickets and other assets."
				)
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: NEW_ITEM_RE })
			).toBeInTheDocument();
			expect(
				screen.queryByTestId("item-list-skeleton")
			).not.toBeInTheDocument();
		});

		it("calls onCreate when the empty-state CTA is clicked", async () => {
			const user = userEvent.setup();
			const onCreate = vi.fn();
			render(<ItemList isLoading={false} items={[]} onCreate={onCreate} />);
			await user.click(screen.getByRole("button", { name: NEW_ITEM_RE }));
			expect(onCreate).toHaveBeenCalledTimes(1);
		});
	});

	describe("data", () => {
		it("renders one card per item and no empty state", () => {
			render(
				<ItemList
					isLoading={false}
					items={[item("i1", "Ticket"), item("i2", "Voucher")]}
					onCreate={vi.fn()}
				/>
			);
			expect(screen.getByText("Ticket")).toBeInTheDocument();
			expect(screen.getByText("Voucher")).toBeInTheDocument();
			expect(screen.queryByText("No items yet")).not.toBeInTheDocument();
			expect(
				screen.queryByTestId("item-list-skeleton")
			).not.toBeInTheDocument();
		});
	});

	describe("error", () => {
		it("renders a retryable error instead of the empty state and retries once", async () => {
			const user = userEvent.setup();
			const onRetry = vi.fn();
			render(
				<ItemList
					isError
					isLoading={false}
					items={[]}
					onCreate={vi.fn()}
					onRetry={onRetry}
				/>
			);
			expect(
				screen.getByText("Unable to load items. Please try again.")
			).toBeInTheDocument();
			expect(screen.queryByText("No items yet")).not.toBeInTheDocument();
			await user.click(screen.getByRole("button", { name: "Retry" }));
			expect(onRetry).toHaveBeenCalledTimes(1);
		});
	});
});
