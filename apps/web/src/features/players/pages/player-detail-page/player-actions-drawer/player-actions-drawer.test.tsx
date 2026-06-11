import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayerActionsDrawer } from "./player-actions-drawer";

const EDIT_RE = /Edit player/i;
const DELETE_RE = /Delete player/i;

function setup(
	overrides: Partial<React.ComponentProps<typeof PlayerActionsDrawer>> = {}
) {
	const props = {
		onDelete: vi.fn(),
		onEdit: vi.fn(),
		onOpenChange: vi.fn(),
		open: true,
		...overrides,
	};
	render(<PlayerActionsDrawer {...props} />);
	return props;
}

describe("PlayerActionsDrawer", () => {
	it("does not render the actions when closed", () => {
		setup({ open: false });
		expect(
			screen.queryByRole("button", { name: EDIT_RE })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: DELETE_RE })
		).not.toBeInTheDocument();
	});

	it("renders Edit and Delete actions when open", () => {
		setup({ open: true });
		expect(screen.getByRole("button", { name: EDIT_RE })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: DELETE_RE })).toBeInTheDocument();
	});

	it("calls onEdit when the Edit action is clicked", async () => {
		const user = userEvent.setup();
		const props = setup({ open: true });
		await user.click(screen.getByRole("button", { name: EDIT_RE }));
		expect(props.onEdit).toHaveBeenCalledTimes(1);
	});

	it("calls onDelete when the Delete action is clicked", async () => {
		const user = userEvent.setup();
		const props = setup({ open: true });
		await user.click(screen.getByRole("button", { name: DELETE_RE }));
		expect(props.onDelete).toHaveBeenCalledTimes(1);
	});
});
