import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameVariantRow } from "../types";

const NEW_VARIANT_RE = /New variant/i;
const SHOW_ARCHIVED_RE = /Show archived/i;
const HIDE_ARCHIVED_RE = /Hide archived/i;
const DOOMED_VARIANT_RE = /Doomed variant/;

const hoisted = vi.hoisted(() => ({
	useGameVariantsPage: vi.fn(),
}));

vi.mock("../use-game-variants-page", () => ({
	useGameVariantsPage: hoisted.useGameVariantsPage,
}));

// VariantContent owns the loading / empty / data switch (covered by its own
// test). Stub it so the page test focuses on wiring.
vi.mock("../variant-content", () => ({
	VariantContent: ({
		activeVariants,
		archivedVariants,
		isLoading,
		onEdit,
		onArchive,
		onRestore,
		onDelete,
		showArchived,
	}: {
		activeVariants: GameVariantRow[];
		archivedVariants: GameVariantRow[];
		isLoading: boolean;
		onArchive: (id: string) => void;
		onDelete: (variant: GameVariantRow) => void;
		onEdit: (variant: GameVariantRow) => void;
		onRestore: (id: string) => void;
		showArchived: boolean;
	}) => (
		<div
			data-active-count={activeVariants.length}
			data-archived-count={archivedVariants.length}
			data-loading={String(isLoading)}
			data-show-archived={String(showArchived)}
			data-testid="variant-content-stub"
		>
			<button onClick={() => onEdit(activeVariants[0])} type="button">
				stub-edit
			</button>
			<button onClick={() => onArchive("v1")} type="button">
				stub-archive
			</button>
			<button onClick={() => onRestore("v1")} type="button">
				stub-restore
			</button>
			<button onClick={() => onDelete(activeVariants[0])} type="button">
				stub-delete
			</button>
		</div>
	),
}));

vi.mock("@/features/game-variants/components/game-variant-form", () => ({
	GameVariantForm: () => <div data-testid="game-variant-form-stub" />,
}));

import { GameVariantsPage } from "@/features/game-variants/pages/game-variants-page/game-variants-page";

function variant(overrides: Partial<GameVariantRow> = {}): GameVariantRow {
	return {
		archivedAt: null,
		blindLabel1: "SB",
		blindLabel2: "BB",
		blindLabel3: "Straddle",
		id: "v1",
		name: "NLH",
		sortOrder: 0,
		...overrides,
	};
}

interface MockState {
	activeVariants: GameVariantRow[];
	archivedVariants: GameVariantRow[];
	cancelDelete: ReturnType<typeof vi.fn>;
	editingVariant: GameVariantRow | null;
	handleArchive: ReturnType<typeof vi.fn>;
	handleConfirmDelete: ReturnType<typeof vi.fn>;
	handleCreate: ReturnType<typeof vi.fn>;
	handleRestore: ReturnType<typeof vi.fn>;
	handleUpdate: ReturnType<typeof vi.fn>;
	isCreateOpen: boolean;
	isCreatePending: boolean;
	isLoading: boolean;
	isUpdatePending: boolean;
	openDelete: ReturnType<typeof vi.fn>;
	pendingDelete: GameVariantRow | null;
	setEditingVariant: ReturnType<typeof vi.fn>;
	setIsCreateOpen: ReturnType<typeof vi.fn>;
	showArchived: boolean;
	toggleArchived: ReturnType<typeof vi.fn>;
}

function setState(overrides: Partial<MockState> = {}): MockState {
	const state: MockState = {
		activeVariants: [],
		archivedVariants: [],
		cancelDelete: vi.fn(),
		editingVariant: null,
		handleArchive: vi.fn(),
		handleConfirmDelete: vi.fn(),
		handleCreate: vi.fn(),
		handleRestore: vi.fn(),
		handleUpdate: vi.fn(),
		isCreateOpen: false,
		isCreatePending: false,
		isLoading: false,
		isUpdatePending: false,
		openDelete: vi.fn(),
		pendingDelete: null,
		setEditingVariant: vi.fn(),
		setIsCreateOpen: vi.fn(),
		showArchived: false,
		toggleArchived: vi.fn(),
		...overrides,
	};
	hoisted.useGameVariantsPage.mockReturnValue(state);
	return state;
}

describe("GameVariantsPage", () => {
	beforeEach(() => {
		hoisted.useGameVariantsPage.mockReset();
	});

	it("renders the PageHeader with the Game variants title", () => {
		setState();
		render(<GameVariantsPage />);
		expect(
			screen.getByRole("heading", { name: "Game variants" })
		).toBeInTheDocument();
	});

	it("forwards isLoading and the variant arrays to VariantContent", () => {
		setState({
			isLoading: true,
			activeVariants: [variant({ id: "v1" })],
			archivedVariants: [variant({ id: "v2" }), variant({ id: "v3" })],
		});
		render(<GameVariantsPage />);
		const stub = screen.getByTestId("variant-content-stub");
		expect(stub).toHaveAttribute("data-loading", "true");
		expect(stub).toHaveAttribute("data-active-count", "1");
		expect(stub).toHaveAttribute("data-archived-count", "2");
	});

	it("opens the create sheet when the header 'New variant' button is clicked", async () => {
		const user = userEvent.setup();
		const state = setState();
		render(<GameVariantsPage />);
		await user.click(screen.getByRole("button", { name: NEW_VARIANT_RE }));
		expect(state.setIsCreateOpen).toHaveBeenCalledTimes(1);
		expect(state.setIsCreateOpen).toHaveBeenCalledWith(true);
	});

	it("does not mount the create form body when isCreateOpen is false", () => {
		setState({ isCreateOpen: false });
		render(<GameVariantsPage />);
		expect(
			screen.queryByTestId("game-variant-form-stub")
		).not.toBeInTheDocument();
	});

	it("mounts the create form body inside the FormSheet when isCreateOpen is true", () => {
		setState({ isCreateOpen: true });
		render(<GameVariantsPage />);
		expect(screen.getByTestId("game-variant-form-stub")).toBeInTheDocument();
	});

	it("disables the create FormSheet Save button while isCreatePending is true", () => {
		setState({ isCreateOpen: true, isCreatePending: true });
		render(<GameVariantsPage />);
		expect(screen.getByLabelText("Save")).toBeDisabled();
	});

	it("does not mount the edit sheet when editingVariant is null", () => {
		setState({ editingVariant: null });
		render(<GameVariantsPage />);
		expect(screen.queryByText("Edit game variant")).not.toBeInTheDocument();
	});

	it("mounts the edit sheet prefilled when editingVariant is set", () => {
		setState({ editingVariant: variant({ id: "v1", name: "NLH" }) });
		render(<GameVariantsPage />);
		expect(screen.getAllByText("Edit game variant").length).toBeGreaterThan(0);
		expect(screen.getByTestId("game-variant-form-stub")).toBeInTheDocument();
	});

	it("calls setEditingVariant(null) when the edit sheet's Cancel is clicked", async () => {
		const user = userEvent.setup();
		const state = setState({ editingVariant: variant({ id: "v1" }) });
		render(<GameVariantsPage />);
		await user.click(screen.getByLabelText("Cancel"));
		expect(state.setEditingVariant).toHaveBeenCalledTimes(1);
		expect(state.setEditingVariant).toHaveBeenCalledWith(null);
	});

	it("forwards showArchived to VariantContent", () => {
		setState({ showArchived: true });
		render(<GameVariantsPage />);
		expect(screen.getByTestId("variant-content-stub")).toHaveAttribute(
			"data-show-archived",
			"true"
		);
	});

	it("shows 'Show archived' label when showArchived is false", () => {
		setState({ showArchived: false });
		render(<GameVariantsPage />);
		expect(
			screen.getByRole("button", { name: SHOW_ARCHIVED_RE })
		).toBeInTheDocument();
	});

	it("shows 'Hide archived' label when showArchived is true", () => {
		setState({ showArchived: true });
		render(<GameVariantsPage />);
		expect(
			screen.getByRole("button", { name: HIDE_ARCHIVED_RE })
		).toBeInTheDocument();
	});

	it("calls toggleArchived when the archived toggle button is clicked", async () => {
		const user = userEvent.setup();
		const state = setState();
		render(<GameVariantsPage />);
		await user.click(screen.getByRole("button", { name: SHOW_ARCHIVED_RE }));
		expect(state.toggleArchived).toHaveBeenCalledTimes(1);
	});

	it("calls setEditingVariant with the variant when VariantContent's onEdit fires", async () => {
		const user = userEvent.setup();
		const target = variant({ id: "v1", name: "NLH" });
		const state = setState({ activeVariants: [target] });
		render(<GameVariantsPage />);
		await user.click(screen.getByRole("button", { name: "stub-edit" }));
		expect(state.setEditingVariant).toHaveBeenCalledTimes(1);
		expect(state.setEditingVariant).toHaveBeenCalledWith(target);
	});

	it("calls handleArchive when VariantContent's onArchive fires", async () => {
		const user = userEvent.setup();
		const state = setState({ activeVariants: [variant({ id: "v1" })] });
		render(<GameVariantsPage />);
		await user.click(screen.getByRole("button", { name: "stub-archive" }));
		expect(state.handleArchive).toHaveBeenCalledTimes(1);
		expect(state.handleArchive).toHaveBeenCalledWith("v1");
	});

	it("calls handleRestore when VariantContent's onRestore fires", async () => {
		const user = userEvent.setup();
		const state = setState({ activeVariants: [variant({ id: "v1" })] });
		render(<GameVariantsPage />);
		await user.click(screen.getByRole("button", { name: "stub-restore" }));
		expect(state.handleRestore).toHaveBeenCalledTimes(1);
		expect(state.handleRestore).toHaveBeenCalledWith("v1");
	});

	it("calls openDelete when VariantContent's onDelete fires", async () => {
		const user = userEvent.setup();
		const target = variant({ id: "v1", name: "NLH" });
		const state = setState({ activeVariants: [target] });
		render(<GameVariantsPage />);
		await user.click(screen.getByRole("button", { name: "stub-delete" }));
		expect(state.openDelete).toHaveBeenCalledTimes(1);
		expect(state.openDelete).toHaveBeenCalledWith(target);
	});

	it("does not show the delete dialog when pendingDelete is null", () => {
		setState({ pendingDelete: null });
		render(<GameVariantsPage />);
		expect(
			screen.queryByText("Delete this game variant?")
		).not.toBeInTheDocument();
	});

	it("shows the delete dialog with the pending variant name", () => {
		setState({ pendingDelete: variant({ name: "Doomed variant" }) });
		render(<GameVariantsPage />);
		expect(screen.getByText(DOOMED_VARIANT_RE)).toBeInTheDocument();
	});

	it("calls handleConfirmDelete when Delete is confirmed", async () => {
		const user = userEvent.setup();
		const state = setState({ pendingDelete: variant({ name: "Doomed" }) });
		render(<GameVariantsPage />);
		await user.click(screen.getByRole("button", { name: "Delete" }));
		expect(state.handleConfirmDelete).toHaveBeenCalledTimes(1);
	});

	it("calls cancelDelete when the delete dialog is cancelled", async () => {
		const user = userEvent.setup();
		const state = setState({ pendingDelete: variant({ name: "Doomed" }) });
		render(<GameVariantsPage />);
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(state.cancelDelete).toHaveBeenCalledTimes(1);
	});
});
