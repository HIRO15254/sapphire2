import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const NEW_CURRENCY_RE = /New currency/i;

// CurrencyListCard renders a TanStack Router <Link> (needs router context), so
// stub the card module. CurrencyListCardSkeleton comes from the same module and
// is used by the loading branch, so stub it too. Its real shape is covered by
// currency-list-card-skeleton.test.tsx.
vi.mock(
	"@/features/currencies/pages/currencies-page/currency-list-card",
	() => ({
		CurrencyListCard: ({
			currency,
			onToggleFavorite,
		}: {
			currency: { id: string; name: string };
			onToggleFavorite: () => void;
		}) => (
			<div data-currency-id={currency.id}>
				<span>{currency.name}</span>
				<button onClick={onToggleFavorite} type="button">
					toggle-{currency.id}
				</button>
			</div>
		),
		CurrencyListCardSkeleton: () => <div data-testid="card-skeleton-stub" />,
	})
);

import { CurrencyList } from "@/features/currencies/pages/currencies-page/currency-list/currency-list";

const currency = (id: string, name: string) => ({
	balance: 0,
	id,
	isFavorite: false,
	name,
	unit: null,
});

describe("CurrencyList", () => {
	describe("loading", () => {
		it("renders the skeleton (5 card skeletons) and neither cards nor empty state", () => {
			render(
				<CurrencyList
					currencies={[]}
					isLoading
					onCreate={vi.fn()}
					onToggleFavorite={vi.fn()}
				/>
			);
			const skeleton = screen.getByTestId("currency-list-skeleton");
			expect(
				within(skeleton).getAllByTestId("card-skeleton-stub")
			).toHaveLength(5);
			expect(screen.queryByText("No currencies yet")).not.toBeInTheDocument();
		});

		it("shows the skeleton while loading even if currencies are already present", () => {
			render(
				<CurrencyList
					currencies={[currency("c1", "USD")]}
					isLoading
					onCreate={vi.fn()}
					onToggleFavorite={vi.fn()}
				/>
			);
			expect(screen.getByTestId("currency-list-skeleton")).toBeInTheDocument();
			expect(screen.queryByText("USD")).not.toBeInTheDocument();
		});
	});

	describe("empty", () => {
		it("renders the empty-state heading, description, and CTA when not loading and no currencies", () => {
			render(
				<CurrencyList
					currencies={[]}
					isLoading={false}
					onCreate={vi.fn()}
					onToggleFavorite={vi.fn()}
				/>
			);
			expect(screen.getByText("No currencies yet")).toBeInTheDocument();
			expect(
				screen.getByText(
					"Create your first currency to start tracking balances."
				)
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: NEW_CURRENCY_RE })
			).toBeInTheDocument();
			expect(
				screen.queryByTestId("currency-list-skeleton")
			).not.toBeInTheDocument();
		});

		it("calls onCreate when the empty-state CTA is clicked", async () => {
			const user = userEvent.setup();
			const onCreate = vi.fn();
			render(
				<CurrencyList
					currencies={[]}
					isLoading={false}
					onCreate={onCreate}
					onToggleFavorite={vi.fn()}
				/>
			);
			await user.click(screen.getByRole("button", { name: NEW_CURRENCY_RE }));
			expect(onCreate).toHaveBeenCalledTimes(1);
		});
	});

	describe("data", () => {
		it("renders one card per currency and no empty state", () => {
			render(
				<CurrencyList
					currencies={[currency("c1", "USD"), currency("c2", "JPY")]}
					isLoading={false}
					onCreate={vi.fn()}
					onToggleFavorite={vi.fn()}
				/>
			);
			expect(screen.getByText("USD")).toBeInTheDocument();
			expect(screen.getByText("JPY")).toBeInTheDocument();
			expect(screen.queryByText("No currencies yet")).not.toBeInTheDocument();
			expect(
				screen.queryByTestId("currency-list-skeleton")
			).not.toBeInTheDocument();
		});

		it("forwards the currency id to onToggleFavorite when a card toggles", async () => {
			const user = userEvent.setup();
			const onToggleFavorite = vi.fn();
			render(
				<CurrencyList
					currencies={[currency("c1", "USD"), currency("c2", "JPY")]}
					isLoading={false}
					onCreate={vi.fn()}
					onToggleFavorite={onToggleFavorite}
				/>
			);
			await user.click(screen.getByRole("button", { name: "toggle-c2" }));
			expect(onToggleFavorite).toHaveBeenCalledTimes(1);
			expect(onToggleFavorite).toHaveBeenCalledWith("c2");
		});
	});
});
