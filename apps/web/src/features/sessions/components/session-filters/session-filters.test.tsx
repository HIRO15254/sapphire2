import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SessionFilters } from "./session-filters";

beforeAll(() => {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});
	Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
		configurable: true,
		value: vi.fn(() => false),
	});
	Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
		configurable: true,
		value: vi.fn(),
	});
	Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
		configurable: true,
		value: vi.fn(),
	});
});

const stores = [
	{ id: "store1", name: "Poker Palace" },
	{ id: "store2", name: "Card Club" },
];

const currencies = [
	{ id: "cur1", name: "Chips" },
	{ id: "cur2", name: "Points" },
];

describe("SessionFilters", () => {
	it("renders filter button", () => {
		render(
			<SessionFilters
				currencies={currencies}
				filters={{}}
				onFiltersChange={vi.fn()}
				stores={stores}
			/>
		);

		expect(screen.getByText("Filter")).toBeInTheDocument();
	});

	it("shows active filter count badge when filters are set", () => {
		render(
			<SessionFilters
				currencies={currencies}
				filters={{ type: "cash_game", storeId: "store1" }}
				onFiltersChange={vi.fn()}
				stores={stores}
			/>
		);

		expect(screen.getByText("2")).toBeInTheDocument();
	});

	it("does not show badge when no filters are active", () => {
		render(
			<SessionFilters
				currencies={currencies}
				filters={{}}
				onFiltersChange={vi.fn()}
				stores={stores}
			/>
		);

		expect(screen.queryByText("0")).not.toBeInTheDocument();
	});

	it("opens filter dialog on button click", async () => {
		const user = userEvent.setup();
		render(
			<SessionFilters
				currencies={currencies}
				filters={{}}
				onFiltersChange={vi.fn()}
				stores={stores}
			/>
		);

		await user.click(screen.getByText("Filter"));

		expect(screen.getByText("Type")).toBeInTheDocument();
		expect(screen.getByText("Store")).toBeInTheDocument();
		expect(screen.getByText("Currency")).toBeInTheDocument();
		expect(screen.getByText("Date Range")).toBeInTheDocument();
	});

	it("calls onFiltersChange with empty object on reset", async () => {
		const user = userEvent.setup();
		const onFiltersChange = vi.fn();
		render(
			<SessionFilters
				currencies={currencies}
				filters={{ type: "cash_game" }}
				onFiltersChange={onFiltersChange}
				stores={stores}
			/>
		);

		await user.click(screen.getByText("Filter"));
		await user.click(screen.getByText("Reset"));

		expect(onFiltersChange).toHaveBeenCalledWith({});
	});

	it("counts all 4 active filters including date range", () => {
		render(
			<SessionFilters
				currencies={currencies}
				filters={{
					type: "cash_game",
					storeId: "store1",
					currencyId: "cur1",
					dateFrom: "2026-04-01",
				}}
				onFiltersChange={vi.fn()}
				stores={stores}
			/>
		);
		expect(screen.getByText("4")).toBeInTheDocument();
	});

	it("renders with empty stores and currencies lists without crashing", async () => {
		const user = userEvent.setup();
		render(
			<SessionFilters
				currencies={[]}
				filters={{}}
				onFiltersChange={vi.fn()}
				stores={[]}
			/>
		);
		await user.click(screen.getByText("Filter"));
		// The dialog still renders all labels; store/currency selects are empty.
		expect(screen.getByText("Store")).toBeInTheDocument();
		expect(screen.getByText("Currency")).toBeInTheDocument();
	});

	it("applies the draft filter values", async () => {
		const user = userEvent.setup();
		const onFiltersChange = vi.fn();

		render(
			<SessionFilters
				currencies={currencies}
				filters={{}}
				onFiltersChange={onFiltersChange}
				stores={stores}
			/>
		);

		await user.click(screen.getByText("Filter"));
		await user.click(screen.getByLabelText("Type"));
		await user.click(screen.getByText("Tournament"));
		await user.click(screen.getByLabelText("Store"));
		await user.click(screen.getByText("Poker Palace"));
		await user.click(screen.getByLabelText("Currency"));
		await user.click(screen.getByText("Points"));
		await user.type(screen.getByLabelText("Date From"), "2026-04-01");
		await user.type(screen.getByLabelText("Date To"), "2026-04-30");
		await user.click(screen.getByText("Apply"));

		expect(onFiltersChange).toHaveBeenCalledWith({
			currencyId: "cur2",
			dateFrom: "2026-04-01",
			dateTo: "2026-04-30",
			storeId: "store1",
			type: "tournament",
		});
	}, 20_000);
});
