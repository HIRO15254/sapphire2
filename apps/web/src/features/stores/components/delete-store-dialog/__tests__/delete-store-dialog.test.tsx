import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteStoreDialog } from "../delete-store-dialog";

const CASCADE_RE = /Akiba Casino and all of its cash games and tournaments/;

function setup(
	props: Partial<React.ComponentProps<typeof DeleteStoreDialog>> = {}
) {
	const onConfirm = vi.fn();
	const onOpenChange = vi.fn();
	render(
		<DeleteStoreDialog
			onConfirm={onConfirm}
			onOpenChange={onOpenChange}
			open
			storeName="Akiba Casino"
			{...props}
		/>
	);
	return { onConfirm, onOpenChange };
}

describe("DeleteStoreDialog", () => {
	it("names the store and warns about cascading deletes", () => {
		setup();
		expect(screen.getByText("Delete this store?")).toBeInTheDocument();
		expect(screen.getByText(CASCADE_RE)).toBeInTheDocument();
	});

	it("calls onConfirm when Delete is clicked", async () => {
		const user = userEvent.setup();
		const { onConfirm } = setup();
		await user.click(screen.getByRole("button", { name: "Delete" }));
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("requests close when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const { onOpenChange, onConfirm } = setup();
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it("renders nothing when closed", () => {
		setup({ open: false });
		expect(screen.queryByText("Delete this store?")).not.toBeInTheDocument();
	});
});
