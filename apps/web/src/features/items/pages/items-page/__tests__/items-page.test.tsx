import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NEW_ITEM_RE = /New item/i;

// Hoisted mock for the page hook so we can drive the page's state
// (open/closed sheet, item list, pending flag) without spinning up
// TanStack Query / a real router.
const hoisted = vi.hoisted(() => ({
	useItemsPage: vi.fn(),
}));

vi.mock("@/features/items/pages/items-page/use-items-page", () => ({
	useItemsPage: hoisted.useItemsPage,
}));

// ItemList owns the loading / empty / data switch (covered by its own test).
// Here it is stubbed so the page test focuses on wiring: the props the page
// feeds in and the callbacks it routes back to page state.
vi.mock("@/features/items/pages/items-page/item-list", () => ({
	ItemList: ({
		items,
		isLoading,
		onCreate,
	}: {
		items: { id: string }[];
		isLoading: boolean;
		onCreate: () => void;
	}) => (
		<div
			data-count={items.length}
			data-loading={String(isLoading)}
			data-testid="item-list-stub"
		>
			<button onClick={onCreate} type="button">
				stub-create
			</button>
		</div>
	),
}));

// ItemFormV2 — the FormSheet body is opaque to this test, so we stub it.
vi.mock("@/features/items/components/item-form", () => ({
	ItemFormV2: () => <div data-testid="item-form-stub" />,
}));

import { ItemsPage } from "@/features/items/pages/items-page/items-page";

interface MockState {
	handleCreate: ReturnType<typeof vi.fn>;
	isCreateOpen: boolean;
	isCreatePending: boolean;
	isError: boolean;
	isLoading: boolean;
	items: {
		currencyName?: string | null;
		currencyUnit?: string | null;
		holdings: number;
		id: string;
		name: string;
		unitValue: number;
	}[];
	retry: ReturnType<typeof vi.fn>;
	setIsCreateOpen: ReturnType<typeof vi.fn>;
}

function setMockState(overrides: Partial<MockState> = {}): MockState {
	const state: MockState = {
		items: [],
		isCreateOpen: false,
		isCreatePending: false,
		isError: false,
		isLoading: false,
		retry: vi.fn(),
		setIsCreateOpen: vi.fn(),
		handleCreate: vi.fn(),
		...overrides,
	};
	hoisted.useItemsPage.mockReturnValue(state);
	return state;
}

describe("ItemsPage", () => {
	beforeEach(() => {
		hoisted.useItemsPage.mockReset();
	});

	it("renders the PageHeader with the Items title", () => {
		setMockState();
		render(<ItemsPage />);
		expect(screen.getByRole("heading", { name: "Items" })).toBeInTheDocument();
	});

	it("forwards isLoading to ItemList", () => {
		setMockState({ isLoading: true });
		render(<ItemsPage />);
		expect(screen.getByTestId("item-list-stub")).toHaveAttribute(
			"data-loading",
			"true"
		);
	});

	it("forwards the items array to ItemList", () => {
		setMockState({
			items: [
				{
					id: "i1",
					name: "Ticket",
					currencyName: "USD",
					currencyUnit: "$",
					unitValue: 100,
					holdings: 3,
				},
				{
					id: "i2",
					name: "Voucher",
					currencyName: null,
					currencyUnit: null,
					unitValue: 5,
					holdings: 0,
				},
			],
		});
		render(<ItemsPage />);
		expect(screen.getByTestId("item-list-stub")).toHaveAttribute(
			"data-count",
			"2"
		);
	});

	it("opens the create sheet when the header 'New item' button is clicked", async () => {
		const user = userEvent.setup();
		const state = setMockState();
		render(<ItemsPage />);
		await user.click(screen.getByRole("button", { name: NEW_ITEM_RE }));
		expect(state.setIsCreateOpen).toHaveBeenCalledTimes(1);
		expect(state.setIsCreateOpen).toHaveBeenCalledWith(true);
	});

	it("opens the create sheet when ItemList's onCreate fires (empty-state CTA)", async () => {
		const user = userEvent.setup();
		const state = setMockState();
		render(<ItemsPage />);
		await user.click(screen.getByRole("button", { name: "stub-create" }));
		expect(state.setIsCreateOpen).toHaveBeenCalledTimes(1);
		expect(state.setIsCreateOpen).toHaveBeenCalledWith(true);
	});

	it("does not mount the create form body when isCreateOpen is false", () => {
		setMockState({ isCreateOpen: false });
		render(<ItemsPage />);
		expect(screen.queryByTestId("item-form-stub")).not.toBeInTheDocument();
	});

	it("mounts the create form body inside the FormSheet when isCreateOpen is true", () => {
		setMockState({ isCreateOpen: true });
		render(<ItemsPage />);
		expect(screen.getByTestId("item-form-stub")).toBeInTheDocument();
	});

	it("disables the FormSheet Save button while isCreatePending is true", () => {
		setMockState({ isCreateOpen: true, isCreatePending: true });
		render(<ItemsPage />);
		expect(screen.getByLabelText("Save")).toBeDisabled();
	});
});
