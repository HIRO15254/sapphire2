import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteSessionDialog } from "@/features/sessions/components/delete-session-dialog";

describe("DeleteSessionDialog", () => {
	it("renders the confirmation prompt when open", () => {
		render(
			<DeleteSessionDialog
				onConfirm={vi.fn()}
				onOpenChange={vi.fn()}
				open={true}
			/>
		);
		expect(
			screen.getByRole("heading", { name: "Delete this session?" })
		).toBeInTheDocument();
	});

	it("invokes onConfirm when Delete is pressed", async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		render(
			<DeleteSessionDialog
				onConfirm={onConfirm}
				onOpenChange={vi.fn()}
				open={true}
			/>
		);
		await user.click(screen.getByRole("button", { name: "Delete" }));
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("requests close when Cancel is pressed", async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		render(
			<DeleteSessionDialog
				onConfirm={vi.fn()}
				onOpenChange={onOpenChange}
				open={true}
			/>
		);
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("renders nothing when closed", () => {
		render(
			<DeleteSessionDialog
				onConfirm={vi.fn()}
				onOpenChange={vi.fn()}
				open={false}
			/>
		);
		expect(
			screen.queryByRole("heading", { name: "Delete this session?" })
		).not.toBeInTheDocument();
	});
});
