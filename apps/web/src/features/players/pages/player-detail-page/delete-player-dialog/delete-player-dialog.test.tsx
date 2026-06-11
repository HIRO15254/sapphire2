import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeletePlayerDialog } from "./delete-player-dialog";

const REMOVED_PERMANENTLY_RE = /Bob will be removed permanently/i;

function setup(
	overrides: Partial<React.ComponentProps<typeof DeletePlayerDialog>> = {}
) {
	const props = {
		onConfirm: vi.fn(),
		onOpenChange: vi.fn(),
		open: true,
		playerName: "Alice",
		...overrides,
	};
	render(<DeletePlayerDialog {...props} />);
	return props;
}

describe("DeletePlayerDialog", () => {
	it("does not render when closed", () => {
		setup({ open: false });
		expect(screen.queryByText("Delete this player?")).not.toBeInTheDocument();
	});

	it("renders the confirmation title and the player name in the body", () => {
		setup({ open: true, playerName: "Bob" });
		expect(screen.getByText("Delete this player?")).toBeInTheDocument();
		expect(screen.getByText(REMOVED_PERMANENTLY_RE)).toBeInTheDocument();
	});

	it("calls onConfirm when Delete is clicked", async () => {
		const user = userEvent.setup();
		const props = setup({ open: true });
		await user.click(screen.getByRole("button", { name: "Delete" }));
		expect(props.onConfirm).toHaveBeenCalledTimes(1);
	});

	it("requests close when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const props = setup({ open: true });
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(props.onOpenChange).toHaveBeenCalledWith(false);
	});
});
