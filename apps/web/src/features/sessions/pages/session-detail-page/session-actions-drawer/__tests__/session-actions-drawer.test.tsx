import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionActionsDrawer } from "@/features/sessions/pages/session-detail-page/session-actions-drawer";

function setup(
	overrides: Partial<React.ComponentProps<typeof SessionActionsDrawer>> = {}
) {
	const props = {
		canReopen: false,
		onDelete: vi.fn(),
		onEdit: vi.fn(),
		onOpenChange: vi.fn(),
		onReopen: vi.fn(),
		open: true,
		...overrides,
	};
	render(<SessionActionsDrawer {...props} />);
	return props;
}

describe("SessionActionsDrawer", () => {
	it("renders edit and delete actions", () => {
		setup();
		expect(
			screen.getByRole("button", { name: "Edit session" })
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Delete session" })
		).toBeInTheDocument();
	});

	it("hides the reopen action when the session cannot be reopened", () => {
		setup({ canReopen: false });
		expect(
			screen.queryByRole("button", { name: "Reopen in tracker" })
		).not.toBeInTheDocument();
	});

	it("shows the reopen action for a reopenable session", () => {
		setup({ canReopen: true });
		expect(
			screen.getByRole("button", { name: "Reopen in tracker" })
		).toBeInTheDocument();
	});

	it("invokes onEdit when the edit action is pressed", async () => {
		const user = userEvent.setup();
		const props = setup();
		await user.click(screen.getByRole("button", { name: "Edit session" }));
		expect(props.onEdit).toHaveBeenCalledTimes(1);
	});

	it("invokes onDelete when the delete action is pressed", async () => {
		const user = userEvent.setup();
		const props = setup();
		await user.click(screen.getByRole("button", { name: "Delete session" }));
		expect(props.onDelete).toHaveBeenCalledTimes(1);
	});

	it("invokes onReopen when the reopen action is pressed", async () => {
		const user = userEvent.setup();
		const props = setup({ canReopen: true });
		await user.click(screen.getByRole("button", { name: "Reopen in tracker" }));
		expect(props.onReopen).toHaveBeenCalledTimes(1);
	});

	it("renders no menu content when closed", () => {
		setup({ open: false });
		expect(
			screen.queryByRole("button", { name: "Edit session" })
		).not.toBeInTheDocument();
	});
});
