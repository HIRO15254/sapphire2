import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FilterPresetsSheet } from "@/shared/components/filter-presets/filter-presets-sheet";
import type { FilterPresetItem } from "@/shared/hooks/use-filter-presets";

const hoisted = vi.hoisted(() => ({
	useFilterPresetsSheet: vi.fn(),
}));

vi.mock("../use-filter-presets-sheet", () => ({
	useFilterPresetsSheet: hoisted.useFilterPresetsSheet,
}));

// vaul's Drawer needs a real pointer environment; the sheet's body is what is
// under test, so render it inline (same approach as
// `features/rooms/components/tournament-form-sheet/tournament-form-sheet.test.tsx`).
vi.mock("@/shared/components/ui/drawer", () => ({
	Drawer: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="drawer">{children}</div>
	),
	DrawerContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DrawerDescription: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DrawerTitle: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/shared/components/management/tag-name-form", () => ({
	TagNameForm: ({
		defaultName,
		formId,
		label,
	}: {
		defaultName?: string;
		formId: string;
		label?: string;
	}) => (
		<form
			data-default-name={defaultName ?? ""}
			data-testid="tag-name-form"
			id={formId}
		>
			{label}
		</form>
	),
}));

function makePreset(
	overrides: Partial<FilterPresetItem> = {}
): FilterPresetItem {
	return {
		id: "p1",
		userId: "u1",
		screenKey: "sessions",
		name: "Cash last 30d",
		payload: { period: "30d" },
		isDefault: false,
		createdAt: "2024-01-01T00:00:00.000Z",
		updatedAt: "2024-01-01T00:00:00.000Z",
		...overrides,
	};
}

const handlers = {
	setActiveTab: vi.fn(),
	onApplyPreset: vi.fn(),
	onToggleDefault: vi.fn(),
	onRequestDelete: vi.fn(),
	onCancelDelete: vi.fn(),
	onConfirmDelete: vi.fn(),
	onSaveNew: vi.fn(),
	onRequestEdit: vi.fn(),
	onCancelEdit: vi.fn(),
	onSubmitEdit: vi.fn(),
};

function setHook(overrides: Record<string, unknown> = {}) {
	hoisted.useFilterPresetsSheet.mockReturnValue({
		activeTab: "saved",
		presets: [] as FilterPresetItem[],
		isLoading: false,
		isCreatePending: false,
		isUpdatePending: false,
		isDeletePending: false,
		isDefaultTogglePending: false,
		pendingDelete: null,
		pendingEdit: null,
		...handlers,
		...overrides,
	});
}

function renderSheet() {
	return render(
		<FilterPresetsSheet
			currentPayload={{ period: "7d" }}
			onApply={vi.fn()}
			onOpenChange={vi.fn()}
			open
			screenKey="sessions"
		/>
	);
}

describe("FilterPresetsSheet", () => {
	beforeEach(() => {
		for (const fn of Object.values(handlers)) {
			fn.mockReset();
		}
		hoisted.useFilterPresetsSheet.mockReset();
		setHook();
	});

	describe("saved list loading / empty / data switch", () => {
		it("renders the row skeleton and not the empty state while presets load", () => {
			setHook({ isLoading: true, presets: [] });
			renderSheet();

			expect(screen.getByTestId("filter-presets-skeleton")).toBeInTheDocument();
			expect(
				screen.queryByText("No saved presets yet")
			).not.toBeInTheDocument();
		});

		it("still renders the skeleton when a stale list is present but the query is loading", () => {
			setHook({ isLoading: true, presets: [makePreset()] });
			renderSheet();

			expect(screen.getByTestId("filter-presets-skeleton")).toBeInTheDocument();
			expect(
				screen.queryByLabelText("Delete Cash last 30d")
			).not.toBeInTheDocument();
		});

		it("renders the empty state once loading finishes with no presets", () => {
			setHook({ isLoading: false, presets: [] });
			renderSheet();

			expect(screen.getByText("No saved presets yet")).toBeInTheDocument();
			expect(
				screen.queryByTestId("filter-presets-skeleton")
			).not.toBeInTheDocument();
		});

		it("renders a row per preset with apply, default, edit and delete actions", () => {
			setHook({
				presets: [
					makePreset(),
					makePreset({ id: "p2", isDefault: true, name: "Tournaments" }),
				],
			});
			renderSheet();

			expect(
				screen.getByRole("button", { name: "Cash last 30d" })
			).toBeInTheDocument();
			expect(
				screen.getByLabelText("Set Cash last 30d as default")
			).toBeInTheDocument();
			expect(
				screen.getByLabelText("Unset Tournaments as default")
			).toBeInTheDocument();
			expect(
				screen.getByLabelText(
					"Rename Cash last 30d or overwrite it with the current filters"
				)
			).toBeInTheDocument();
			expect(screen.getByLabelText("Delete Cash last 30d")).toBeInTheDocument();
			expect(
				screen.queryByTestId("filter-presets-skeleton")
			).not.toBeInTheDocument();
			expect(
				screen.queryByText("No saved presets yet")
			).not.toBeInTheDocument();
		});
	});

	describe("row actions", () => {
		it("disables only the default toggle while a default change is in flight", () => {
			const preset = makePreset();
			setHook({ presets: [preset], isDefaultTogglePending: true });
			renderSheet();

			expect(
				screen.getByLabelText("Set Cash last 30d as default")
			).toBeDisabled();
			expect(screen.getByLabelText("Delete Cash last 30d")).toBeEnabled();
			expect(
				screen.getByLabelText(
					"Rename Cash last 30d or overwrite it with the current filters"
				)
			).toBeEnabled();
		});

		it("enables the default toggle when no default change is in flight", () => {
			setHook({ presets: [makePreset()], isDefaultTogglePending: false });
			renderSheet();

			expect(
				screen.getByLabelText("Set Cash last 30d as default")
			).toBeEnabled();
		});

		it("calls onRequestEdit with the row's preset when the edit action is clicked", () => {
			const preset = makePreset();
			setHook({ presets: [preset] });
			renderSheet();

			fireEvent.click(
				screen.getByLabelText(
					"Rename Cash last 30d or overwrite it with the current filters"
				)
			);

			expect(handlers.onRequestEdit).toHaveBeenCalledTimes(1);
			expect(handlers.onRequestEdit).toHaveBeenNthCalledWith(1, preset);
		});
	});

	describe("rename / overwrite form", () => {
		it("replaces the saved list with the edit form and warns that the filters are overwritten", () => {
			const preset = makePreset();
			setHook({ presets: [preset], pendingEdit: preset });
			renderSheet();

			const form = screen.getByTestId("tag-name-form");
			expect(form).toHaveAttribute("id", "filter-presets-edit-form");
			expect(form).toHaveAttribute("data-default-name", "Cash last 30d");
			expect(form).toHaveTextContent("Preset name");
			expect(
				screen.getByText(
					"Saving renames this preset and replaces its saved filters with the filters you have applied right now."
				)
			).toBeInTheDocument();
			expect(
				screen.queryByLabelText("Delete Cash last 30d")
			).not.toBeInTheDocument();
		});

		it("submits the edit form by id and keeps the create form's id distinct", () => {
			const preset = makePreset();
			setHook({ presets: [preset], pendingEdit: preset });
			renderSheet();

			expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
				"form",
				"filter-presets-edit-form"
			);
		});

		it("disables the edit form's Save button while the update is pending", () => {
			const preset = makePreset();
			setHook({
				presets: [preset],
				pendingEdit: preset,
				isUpdatePending: true,
			});
			renderSheet();

			expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
		});

		it("Cancel leaves the edit form without submitting", () => {
			const preset = makePreset();
			setHook({ presets: [preset], pendingEdit: preset });
			renderSheet();

			fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

			expect(handlers.onCancelEdit).toHaveBeenCalledTimes(1);
			expect(handlers.onSubmitEdit).not.toHaveBeenCalled();
		});

		it("keeps exactly the two existing tabs while editing", () => {
			const preset = makePreset();
			setHook({ presets: [preset], pendingEdit: preset });
			renderSheet();

			const tabs = screen.getAllByRole("tab");
			expect(tabs).toHaveLength(2);
			expect(tabs.map((tab) => tab.textContent)).toEqual(["Saved", "Save new"]);
		});
	});

	describe("create tab", () => {
		it("renders the create form with its own form id", () => {
			setHook({ activeTab: "create" });
			renderSheet();

			expect(screen.getByTestId("tag-name-form")).toHaveAttribute(
				"id",
				"filter-presets-create-form"
			);
			expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
				"form",
				"filter-presets-create-form"
			);
			expect(
				screen.queryByTestId("filter-presets-skeleton")
			).not.toBeInTheDocument();
		});
	});
});
