import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NEW_CURRENCY_RE = /New currency/i;

// Hoisted mock for the page hook so we can drive the page's state
// (open/closed sheet, currency list, pending flag) without spinning up
// TanStack Query / a real router.
const hoisted = vi.hoisted(() => ({
	useCurrenciesPage: vi.fn(),
}));

vi.mock(
	"@/features/currencies/v2/pages/currencies-page/use-currencies-page",
	() => ({
		useCurrenciesPage: hoisted.useCurrenciesPage,
	})
);

// The CurrencyListCard renders a TanStack Router <Link>, which needs a
// router context — replace it with a stub that just shows the name so
// the component test doesn't require a real router.
vi.mock(
	"@/features/currencies/v2/pages/currencies-page/currency-list-card",
	() => ({
		CurrencyListCard: ({
			currency,
		}: {
			currency: { id: string; name: string };
		}) => <div data-currency-id={currency.id}>{currency.name}</div>,
	})
);

// Same for CurrencyFormV2 — the FormSheet body is opaque to this test,
// so we can stub it.
vi.mock("@/features/currencies/v2/components/currency-form", () => ({
	CurrencyFormV2: () => <div data-testid="currency-form-stub" />,
}));

import { CurrenciesPage } from "@/features/currencies/v2/pages/currencies-page/currencies-page";

interface MockState {
	currencies: {
		id: string;
		name: string;
		unit?: string | null;
		balance: number;
	}[];
	handleCreate: ReturnType<typeof vi.fn>;
	isCreateOpen: boolean;
	isCreatePending: boolean;
	isLoading: boolean;
	setIsCreateOpen: ReturnType<typeof vi.fn>;
}

function setMockState(overrides: Partial<MockState> = {}): MockState {
	const state: MockState = {
		currencies: [],
		isCreateOpen: false,
		isCreatePending: false,
		isLoading: false,
		setIsCreateOpen: vi.fn(),
		handleCreate: vi.fn(),
		...overrides,
	};
	hoisted.useCurrenciesPage.mockReturnValue(state);
	return state;
}

describe("CurrenciesPage", () => {
	beforeEach(() => {
		hoisted.useCurrenciesPage.mockReset();
	});

	it("renders the PageHeader with the Currencies title", () => {
		setMockState();
		render(<CurrenciesPage />);
		expect(
			screen.getByRole("heading", { name: "Currencies" })
		).toBeInTheDocument();
	});

	it("shows the loading skeleton (and no empty state / cards) while isLoading", () => {
		setMockState({ isLoading: true, currencies: [] });
		render(<CurrenciesPage />);
		expect(screen.getByTestId("currency-list-skeleton")).toBeInTheDocument();
		expect(screen.queryByText("No currencies yet")).not.toBeInTheDocument();
	});

	it("does not show the skeleton once loading has finished", () => {
		setMockState({ isLoading: false, currencies: [] });
		render(<CurrenciesPage />);
		expect(
			screen.queryByTestId("currency-list-skeleton")
		).not.toBeInTheDocument();
	});

	it("renders the empty state heading + CTA when there are no currencies", () => {
		setMockState({ currencies: [] });
		render(<CurrenciesPage />);
		expect(screen.getByText("No currencies yet")).toBeInTheDocument();
		expect(
			screen.getByText("Create your first currency to start tracking balances.")
		).toBeInTheDocument();
		// Two "New currency" buttons exist when empty: the header action +
		// the empty-state action.
		expect(
			screen.getAllByRole("button", { name: NEW_CURRENCY_RE })
		).toHaveLength(2);
	});

	it("renders one CurrencyListCard per currency and no empty state when the list is non-empty", () => {
		setMockState({
			currencies: [
				{ id: "c1", name: "USD", unit: "$", balance: 100 },
				{ id: "c2", name: "JPY", unit: "¥", balance: 1000 },
				{ id: "c3", name: "Chips", unit: null, balance: 0 },
			],
		});
		render(<CurrenciesPage />);
		expect(screen.queryByText("No currencies yet")).not.toBeInTheDocument();
		expect(screen.getByText("USD")).toBeInTheDocument();
		expect(screen.getByText("JPY")).toBeInTheDocument();
		expect(screen.getByText("Chips")).toBeInTheDocument();
	});

	it("opens the create sheet when the header 'New currency' button is clicked", async () => {
		const user = userEvent.setup();
		const state = setMockState();
		render(<CurrenciesPage />);
		const [headerButton] = screen.getAllByRole("button", {
			name: NEW_CURRENCY_RE,
		});
		await user.click(headerButton);
		expect(state.setIsCreateOpen).toHaveBeenCalledTimes(1);
		expect(state.setIsCreateOpen).toHaveBeenCalledWith(true);
	});

	it("opens the create sheet when the empty-state CTA is clicked", async () => {
		const user = userEvent.setup();
		const state = setMockState({ currencies: [] });
		render(<CurrenciesPage />);
		// The empty-state action is the second "New currency" button.
		const buttons = screen.getAllByRole("button", { name: NEW_CURRENCY_RE });
		await user.click(buttons[1]);
		expect(state.setIsCreateOpen).toHaveBeenCalledTimes(1);
		expect(state.setIsCreateOpen).toHaveBeenCalledWith(true);
	});

	it("does not mount the create form body when isCreateOpen is false", () => {
		setMockState({ isCreateOpen: false });
		render(<CurrenciesPage />);
		expect(screen.queryByTestId("currency-form-stub")).not.toBeInTheDocument();
	});

	it("mounts the create form body inside the FormSheet when isCreateOpen is true", () => {
		setMockState({ isCreateOpen: true });
		render(<CurrenciesPage />);
		expect(screen.getByTestId("currency-form-stub")).toBeInTheDocument();
	});

	it("disables the FormSheet Save button while isCreatePending is true", () => {
		setMockState({ isCreateOpen: true, isCreatePending: true });
		render(<CurrenciesPage />);
		expect(screen.getByLabelText("Save")).toBeDisabled();
	});
});
