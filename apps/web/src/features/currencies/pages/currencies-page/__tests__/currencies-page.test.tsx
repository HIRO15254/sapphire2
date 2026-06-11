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
	"@/features/currencies/pages/currencies-page/use-currencies-page",
	() => ({
		useCurrenciesPage: hoisted.useCurrenciesPage,
	})
);

// CurrencyList owns the loading / empty / data switch (covered by its own
// test). Here it is stubbed so the page test focuses on wiring: the props the
// page feeds in and the callbacks it routes back to page state.
vi.mock("@/features/currencies/pages/currencies-page/currency-list", () => ({
	CurrencyList: ({
		currencies,
		isLoading,
		onCreate,
		onToggleFavorite,
	}: {
		currencies: { id: string }[];
		isLoading: boolean;
		onCreate: () => void;
		onToggleFavorite: (id: string) => void;
	}) => (
		<div
			data-count={currencies.length}
			data-loading={String(isLoading)}
			data-testid="currency-list-stub"
		>
			<button onClick={onCreate} type="button">
				stub-create
			</button>
			<button onClick={() => onToggleFavorite("c-stub")} type="button">
				stub-toggle
			</button>
		</div>
	),
}));

// CurrencyFormV2 — the FormSheet body is opaque to this test, so we stub it.
vi.mock("@/features/currencies/components/currency-form", () => ({
	CurrencyFormV2: () => <div data-testid="currency-form-stub" />,
}));

import { CurrenciesPage } from "@/features/currencies/pages/currencies-page/currencies-page";

interface MockState {
	currencies: {
		id: string;
		name: string;
		unit?: string | null;
		balance: number;
	}[];
	handleCreate: ReturnType<typeof vi.fn>;
	handleToggleFavorite: ReturnType<typeof vi.fn>;
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
		handleToggleFavorite: vi.fn(),
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

	it("forwards isLoading to CurrencyList", () => {
		setMockState({ isLoading: true });
		render(<CurrenciesPage />);
		expect(screen.getByTestId("currency-list-stub")).toHaveAttribute(
			"data-loading",
			"true"
		);
	});

	it("forwards the currencies array to CurrencyList", () => {
		setMockState({
			currencies: [
				{ id: "c1", name: "USD", unit: "$", balance: 100 },
				{ id: "c2", name: "JPY", unit: "¥", balance: 1000 },
			],
		});
		render(<CurrenciesPage />);
		expect(screen.getByTestId("currency-list-stub")).toHaveAttribute(
			"data-count",
			"2"
		);
	});

	it("opens the create sheet when the header 'New currency' button is clicked", async () => {
		const user = userEvent.setup();
		const state = setMockState();
		render(<CurrenciesPage />);
		await user.click(screen.getByRole("button", { name: NEW_CURRENCY_RE }));
		expect(state.setIsCreateOpen).toHaveBeenCalledTimes(1);
		expect(state.setIsCreateOpen).toHaveBeenCalledWith(true);
	});

	it("opens the create sheet when CurrencyList's onCreate fires (empty-state CTA)", async () => {
		const user = userEvent.setup();
		const state = setMockState();
		render(<CurrenciesPage />);
		await user.click(screen.getByRole("button", { name: "stub-create" }));
		expect(state.setIsCreateOpen).toHaveBeenCalledTimes(1);
		expect(state.setIsCreateOpen).toHaveBeenCalledWith(true);
	});

	it("routes CurrencyList's onToggleFavorite to the page handler with the id", async () => {
		const user = userEvent.setup();
		const state = setMockState();
		render(<CurrenciesPage />);
		await user.click(screen.getByRole("button", { name: "stub-toggle" }));
		expect(state.handleToggleFavorite).toHaveBeenCalledTimes(1);
		expect(state.handleToggleFavorite).toHaveBeenCalledWith("c-stub");
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
