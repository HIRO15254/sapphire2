import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NEW_STORE_RE = /New store/i;

const hoisted = vi.hoisted(() => ({
	useStoresPage: vi.fn(),
}));

vi.mock("@/features/stores/pages/stores-page/use-stores-page", () => ({
	useStoresPage: hoisted.useStoresPage,
}));

// StoreList owns the loading / empty / data switch (covered by its own test).
// Stub it so the page test focuses on wiring.
vi.mock("@/features/stores/pages/stores-page/store-list", () => ({
	StoreList: ({
		stores,
		isLoading,
		onCreate,
	}: {
		stores: { id: string }[];
		isLoading: boolean;
		onCreate: () => void;
	}) => (
		<div
			data-count={stores.length}
			data-loading={String(isLoading)}
			data-testid="store-list-stub"
		>
			<button onClick={onCreate} type="button">
				stub-create
			</button>
		</div>
	),
}));

vi.mock("@/features/stores/components/store-form", () => ({
	StoreForm: () => <div data-testid="store-form-stub" />,
}));

import { StoresPage } from "@/features/stores/pages/stores-page/stores-page";

interface MockState {
	handleCreate: ReturnType<typeof vi.fn>;
	isCreateOpen: boolean;
	isCreatePending: boolean;
	isLoading: boolean;
	setIsCreateOpen: ReturnType<typeof vi.fn>;
	stores: {
		id: string;
		name: string;
		ringGameCount: number;
		tournamentCount: number;
	}[];
}

function setMockState(overrides: Partial<MockState> = {}): MockState {
	const state: MockState = {
		stores: [],
		isCreateOpen: false,
		isCreatePending: false,
		isLoading: false,
		setIsCreateOpen: vi.fn(),
		handleCreate: vi.fn(),
		...overrides,
	};
	hoisted.useStoresPage.mockReturnValue(state);
	return state;
}

describe("StoresPage", () => {
	beforeEach(() => {
		hoisted.useStoresPage.mockReset();
	});

	it("renders the PageHeader with the Stores title", () => {
		setMockState();
		render(<StoresPage />);
		expect(screen.getByRole("heading", { name: "Stores" })).toBeInTheDocument();
	});

	it("forwards isLoading to StoreList", () => {
		setMockState({ isLoading: true });
		render(<StoresPage />);
		expect(screen.getByTestId("store-list-stub")).toHaveAttribute(
			"data-loading",
			"true"
		);
	});

	it("forwards the stores array to StoreList", () => {
		setMockState({
			stores: [
				{ id: "s1", name: "Akiba", ringGameCount: 0, tournamentCount: 0 },
				{ id: "s2", name: "Shinjuku", ringGameCount: 1, tournamentCount: 2 },
			],
		});
		render(<StoresPage />);
		expect(screen.getByTestId("store-list-stub")).toHaveAttribute(
			"data-count",
			"2"
		);
	});

	it("opens the create sheet when the header 'New store' button is clicked", async () => {
		const user = userEvent.setup();
		const state = setMockState();
		render(<StoresPage />);
		await user.click(screen.getByRole("button", { name: NEW_STORE_RE }));
		expect(state.setIsCreateOpen).toHaveBeenCalledTimes(1);
		expect(state.setIsCreateOpen).toHaveBeenCalledWith(true);
	});

	it("opens the create sheet when StoreList's onCreate fires (empty-state CTA)", async () => {
		const user = userEvent.setup();
		const state = setMockState();
		render(<StoresPage />);
		await user.click(screen.getByRole("button", { name: "stub-create" }));
		expect(state.setIsCreateOpen).toHaveBeenCalledTimes(1);
		expect(state.setIsCreateOpen).toHaveBeenCalledWith(true);
	});

	it("does not mount the create form body when isCreateOpen is false", () => {
		setMockState({ isCreateOpen: false });
		render(<StoresPage />);
		expect(screen.queryByTestId("store-form-stub")).not.toBeInTheDocument();
	});

	it("mounts the create form body inside the FormSheet when isCreateOpen is true", () => {
		setMockState({ isCreateOpen: true });
		render(<StoresPage />);
		expect(screen.getByTestId("store-form-stub")).toBeInTheDocument();
	});

	it("disables the FormSheet Save button while isCreatePending is true", () => {
		setMockState({ isCreateOpen: true, isCreatePending: true });
		render(<StoresPage />);
		expect(screen.getByLabelText("Save")).toBeDisabled();
	});
});
