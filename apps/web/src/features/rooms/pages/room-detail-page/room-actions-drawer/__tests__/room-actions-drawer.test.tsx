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
	const onArchive = vi.fn();
	const onRestore = vi.fn();
	render(
		<RoomActionsDrawer
			isArchived={false}
			isFavorite={false}
			onArchive={onArchive}
			onDelete={onDelete}
			onEdit={onEdit}
			onOpenChange={onOpenChange}
			onRestore={onRestore}
			onToggleFavorite={onToggleFavorite}
			open
			{...props}
		/>
	);
	return {
		onArchive,
		onRestore,
		onDelete,
		onEdit,
		onOpenChange,
		onToggleFavorite,
	};
}

describe("RoomActionsDrawer", () => {
	it("archives an active room from its actions", async () => {
		const user = userEvent.setup();
		const { onArchive } = setup();
		await user.click(screen.getByRole("button", { name: "Archive room" }));
		expect(onArchive).toHaveBeenCalledTimes(1);
		expect(
			screen.queryByRole("button", { name: "Restore room" })
		).not.toBeInTheDocument();
	});
	it("restores an archived room from its actions", async () => {
		const user = userEvent.setup();
		const { onRestore } = setup({ isArchived: true });
		await user.click(screen.getByRole("button", { name: "Restore room" }));
		expect(onRestore).toHaveBeenCalledTimes(1);
		expect(
			screen.queryByRole("button", { name: "Archive room" })
		).not.toBeInTheDocument();
	});
	it("renders Edit and Delete room actions", () => {
		setup();
		expect(screen.getByText("Edit room")).toBeInTheDocument();
		expect(screen.getByText("Delete room")).toBeInTheDocument();
	});

	it("renders 'Add to favorites' when isFavorite is false", () => {
		setup({ isFavorite: false });
		expect(screen.getByText("Add to favorites")).toBeInTheDocument();
	});

	it("renders 'Remove from favorites' when isFavorite is true", () => {
		setup({ isFavorite: true });
		expect(screen.getByText("Remove from favorites")).toBeInTheDocument();
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
