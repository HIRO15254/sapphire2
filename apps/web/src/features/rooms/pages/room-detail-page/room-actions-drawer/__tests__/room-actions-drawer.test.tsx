import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RoomActionsDrawer } from "../room-actions-drawer";

function setup(
	props: Partial<React.ComponentProps<typeof RoomActionsDrawer>> = {}
) {
	const onDelete = vi.fn();
	const onEdit = vi.fn();
	const onOpenChange = vi.fn();
	const onToggleFavorite = vi.fn();
	render(
		<RoomActionsDrawer
			isFavorite={false}
			onDelete={onDelete}
			onEdit={onEdit}
			onOpenChange={onOpenChange}
			onToggleFavorite={onToggleFavorite}
			open
			{...props}
		/>
	);
	return { onDelete, onEdit, onOpenChange, onToggleFavorite };
}

describe("RoomActionsDrawer", () => {
	it("renders Edit and Delete room actions", () => {
		setup();
		expect(screen.getByText("Edit room")).toBeInTheDocument();
		expect(screen.getByText("Delete room")).toBeInTheDocument();
	});

	it.each([
		[false, "Add to favorites"],
		[true, "Remove from favorites"],
	])("renders the correct favorite label when isFavorite is %s", (isFavorite, label) => {
		setup({ isFavorite });
		expect(screen.getByText(label)).toBeInTheDocument();
	});

	it("calls onToggleFavorite when the favorite item is clicked", async () => {
		const user = userEvent.setup();
		const { onToggleFavorite } = setup({ isFavorite: false });
		await user.click(screen.getByText("Add to favorites"));
		expect(onToggleFavorite).toHaveBeenCalledTimes(1);
	});

	it("calls onEdit when Edit room is clicked", async () => {
		const user = userEvent.setup();
		const { onEdit } = setup();
		await user.click(screen.getByText("Edit room"));
		expect(onEdit).toHaveBeenCalledTimes(1);
	});

	it("calls onDelete when Delete room is clicked", async () => {
		const user = userEvent.setup();
		const { onDelete } = setup();
		await user.click(screen.getByText("Delete room"));
		expect(onDelete).toHaveBeenCalledTimes(1);
	});

	it("renders nothing when closed", () => {
		setup({ open: false });
		expect(screen.queryByText("Edit room")).not.toBeInTheDocument();
	});
});
