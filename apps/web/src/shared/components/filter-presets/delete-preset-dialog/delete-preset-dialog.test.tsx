import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FilterPresetItem } from "@/shared/hooks/use-filter-presets";
import { DeletePresetDialog } from "./delete-preset-dialog";

const CONFIRM_BODY_RE = /Are you sure you want to delete the preset/i;

function makePreset(
	overrides: Partial<FilterPresetItem> = {}
): FilterPresetItem {
	return {
		id: "p1",
		userId: "u1",
		screenKey: "sessions",
		name: "Cash last 30d",
		payload: {},
		isDefault: false,
		createdAt: "2024-01-01T00:00:00.000Z",
		updatedAt: "2024-01-01T00:00:00.000Z",
		...overrides,
	};
}

function setup(
	overrides: Partial<React.ComponentProps<typeof DeletePresetDialog>> = {}
) {
	const props = {
		isPending: false,
		onCancel: vi.fn(),
		onConfirm: vi.fn(),
		preset: makePreset(),
		...overrides,
	};
	render(<DeletePresetDialog {...props} />);
	return props;
}

describe("DeletePresetDialog", () => {
	it("stays closed when there is no preset pending deletion", () => {
		setup({ preset: null });
		expect(screen.queryByText("Delete preset?")).not.toBeInTheDocument();
	});

	it("opens and names the preset being deleted", () => {
		setup({ preset: makePreset({ name: "Tournaments only" }) });
		expect(screen.getByText("Delete preset?")).toBeInTheDocument();
		expect(screen.getByText(CONFIRM_BODY_RE)).toHaveTextContent(
			"Tournaments only"
		);
	});

	it("calls onConfirm when Delete is clicked", async () => {
		const user = userEvent.setup();
		const props = setup();
		await user.click(screen.getByRole("button", { name: "Delete" }));
		expect(props.onConfirm).toHaveBeenCalledTimes(1);
		expect(props.onCancel).not.toHaveBeenCalled();
	});

	it("calls onCancel when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const props = setup();
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(props.onCancel).toHaveBeenCalledTimes(1);
		expect(props.onConfirm).not.toHaveBeenCalled();
	});

	// The dialog's own `onOpenChange` -> `onCancel` bridge: dismissing with Esc
	// (or the overlay) is the only path that goes through it, and nothing else in
	// the suite covers it — `useFilterPresetsSheet` tests `onCancelDelete` but not
	// who calls it.
	it("calls onCancel when dismissed with Escape", async () => {
		const user = userEvent.setup();
		const props = setup();
		await user.keyboard("{Escape}");
		expect(props.onCancel).toHaveBeenCalledTimes(1);
	});

	it("shows a pending label and disables Delete while the deletion is in flight", () => {
		setup({ isPending: true });
		const deleteButton = screen.getByRole("button", { name: "Deleting..." });
		expect(deleteButton).toBeDisabled();
		// Cancel stays live so a stuck request is escapable.
		expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
	});
});
