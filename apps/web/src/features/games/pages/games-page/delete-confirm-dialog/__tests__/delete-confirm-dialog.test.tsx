import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	DeleteConfirmDialog,
	type DeleteConfirmDialogProps,
} from "../delete-confirm-dialog";

function renderDialog(overrides: Partial<DeleteConfirmDialogProps> = {}) {
	const props: DeleteConfirmDialogProps = {
		title: "Delete this group?",
		description: "Big Duck will be removed from your group list.",
		open: true,
		isPending: false,
		onCancel: vi.fn(),
		onConfirm: vi.fn(),
		...overrides,
	};
	render(<DeleteConfirmDialog {...props} />);
	return props;
}

describe("DeleteConfirmDialog", () => {
	it("renders the title and description when open", () => {
		renderDialog();
		expect(
			screen.getByRole("heading", { name: "Delete this group?" })
		).toBeInTheDocument();
		expect(
			screen.getByText("Big Duck will be removed from your group list.")
		).toBeInTheDocument();
	});

	it("renders nothing when closed", () => {
		renderDialog({ open: false });
		expect(
			screen.queryByRole("heading", { name: "Delete this group?" })
		).not.toBeInTheDocument();
	});

	it("calls onCancel when the Cancel button is clicked", async () => {
		const user = userEvent.setup();
		const { onCancel } = renderDialog();
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it("calls onConfirm when the Delete button is clicked", async () => {
		const user = userEvent.setup();
		const { onConfirm } = renderDialog();
		await user.click(screen.getByRole("button", { name: "Delete" }));
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("calls onCancel when the dialog is dismissed without confirming", async () => {
		const user = userEvent.setup();
		const { onCancel, onConfirm } = renderDialog();
		await user.click(screen.getByRole("button", { name: "Close" }));
		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it("disables the Delete button while isPending is true", () => {
		renderDialog({ isPending: true });
		expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
	});

	it("keeps the Delete button enabled while isPending is false", () => {
		renderDialog({ isPending: false });
		expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
	});

	it("renders a ReactNode description", () => {
		renderDialog({
			description: (
				<>
					<strong>Zeta</strong> will be removed from your variant list.
				</>
			),
		});
		expect(screen.getByText("Zeta")).toBeInTheDocument();
	});
});
