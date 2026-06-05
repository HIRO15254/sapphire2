import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StoreActionsDrawer } from "../store-actions-drawer";

function setup(
	props: Partial<React.ComponentProps<typeof StoreActionsDrawer>> = {}
) {
	const onDelete = vi.fn();
	const onEdit = vi.fn();
	const onOpenChange = vi.fn();
	render(
		<StoreActionsDrawer
			onDelete={onDelete}
			onEdit={onEdit}
			onOpenChange={onOpenChange}
			open
			{...props}
		/>
	);
	return { onDelete, onEdit, onOpenChange };
}

describe("StoreActionsDrawer", () => {
	it("renders Edit and Delete store actions", () => {
		setup();
		expect(screen.getByText("Edit store")).toBeInTheDocument();
		expect(screen.getByText("Delete store")).toBeInTheDocument();
	});

	it("calls onEdit when Edit store is clicked", async () => {
		const user = userEvent.setup();
		const { onEdit } = setup();
		await user.click(screen.getByText("Edit store"));
		expect(onEdit).toHaveBeenCalledTimes(1);
	});

	it("calls onDelete when Delete store is clicked", async () => {
		const user = userEvent.setup();
		const { onDelete } = setup();
		await user.click(screen.getByText("Delete store"));
		expect(onDelete).toHaveBeenCalledTimes(1);
	});

	it("renders nothing when closed", () => {
		setup({ open: false });
		expect(screen.queryByText("Edit store")).not.toBeInTheDocument();
	});
});
