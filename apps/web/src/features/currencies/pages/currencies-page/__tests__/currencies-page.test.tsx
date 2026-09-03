import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NEW_CURRENCY_RE = /New currency/i;

const hoisted = vi.hoisted(() => ({
	useCurrenciesPage: vi.fn(),
}));

vi.mock(
	"@/features/currencies/pages/currencies-page/use-currencies-page",
	() => ({
		useCurrenciesPage: hoisted.useCurrenciesPage,
	})
);

vi.mock("@/features/currencies/pages/currencies-page/currency-list", () => ({
	CurrencyList: ({
		currencies,
		onCreate,
		onToggleFavorite,
	}: {
		currencies: { id: string; name: string }[];
		onCreate: () => void;
		onToggleFavorite: (id: string) => void;
	}) => (
		<div>
			<ul>
				{currencies.map((currency) => (
					<li key={currency.id}>{currency.name}</li>
				))}
			</ul>
			<button onClick={onCreate} type="button">
				stub-create
			</button>
			<button onClick={() => onToggleFavorite("c-stub")} type="button">
				stub-toggle
			</button>
		</div>
	),
}));

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

	it("renders the Currencies heading", () => {
		setMockState();
		render(<CurrenciesPage />);
		expect(
			screen.getByRole("heading", { name: "Currencies" })
		).toBeInTheDocument();
	});

	it("renders one CurrencyList row per currency", () => {
		setMockState({
			currencies: [
				{ id: "c1", name: "USD", unit: "$", balance: 100 },
				{ id: "c2", name: "JPY", unit: "¥", balance: 1000 },
			],
		});
		render(<CurrenciesPage />);
		expect(screen.getAllByRole("listitem")).toHaveLength(2);
	});

	it.each([
		["the header New currency button", NEW_CURRENCY_RE],
		["CurrencyList's empty-state CTA", "stub-create"],
	])("opens the create sheet from %s", async (_, buttonName) => {
		const user = userEvent.setup();
		const state = setMockState();
		render(<CurrenciesPage />);
		await user.click(screen.getByRole("button", { name: buttonName }));
		expect(state.setIsCreateOpen).toHaveBeenCalledTimes(1);
		expect(state.setIsCreateOpen).toHaveBeenCalledWith(true);
	});

	it("routes CurrencyList's favorite toggle to handleToggleFavorite with the id", async () => {
		const user = userEvent.setup();
		const state = setMockState();
		render(<CurrenciesPage />);
		await user.click(screen.getByRole("button", { name: "stub-toggle" }));
		expect(state.handleToggleFavorite).toHaveBeenCalledTimes(1);
		expect(state.handleToggleFavorite).toHaveBeenCalledWith("c-stub");
	});

	it("mounts the create form only while the sheet is open", () => {
		setMockState({ isCreateOpen: false });
		const { rerender } = render(<CurrenciesPage />);
		expect(screen.queryByTestId("currency-form-stub")).not.toBeInTheDocument();
		setMockState({ isCreateOpen: true });
		rerender(<CurrenciesPage />);
		expect(screen.getByTestId("currency-form-stub")).toBeInTheDocument();
	});

	it("disables Save while the create mutation is pending", () => {
		setMockState({ isCreateOpen: true, isCreatePending: true });
		render(<CurrenciesPage />);
		expect(screen.getByLabelText("Save")).toBeDisabled();
	});
});
