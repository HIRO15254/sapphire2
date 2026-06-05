import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GameActionsDrawer } from "../game-actions-drawer";

function setup(
	props: Partial<React.ComponentProps<typeof GameActionsDrawer>> = {}
) {
	const handlers = {
		onArchive: vi.fn(),
		onDelete: vi.fn(),
		onEdit: vi.fn(),
		onOpenChange: vi.fn(),
		onRestore: vi.fn(),
	};
	render(
		<GameActionsDrawer
			isArchived={false}
			label="cash game"
			open
			{...handlers}
			{...props}
		/>
	);
	return handlers;
}

describe("GameActionsDrawer", () => {
	it("renders Edit and Delete actions labelled with the entity", () => {
		setup();
		expect(screen.getByText("Edit cash game")).toBeInTheDocument();
		expect(screen.getByText("Delete cash game")).toBeInTheDocument();
	});

	it("shows Archive (not Restore) when the target is active", () => {
		setup({ isArchived: false });
		expect(screen.getByText("Archive cash game")).toBeInTheDocument();
		expect(screen.queryByText("Restore cash game")).not.toBeInTheDocument();
	});

	it("shows Restore (not Archive) when the target is archived", () => {
		setup({ isArchived: true });
		expect(screen.getByText("Restore cash game")).toBeInTheDocument();
		expect(screen.queryByText("Archive cash game")).not.toBeInTheDocument();
	});

	it("uses the provided label for both the actions and the sr-only title", () => {
		setup({ label: "tournament" });
		expect(screen.getByText("Edit tournament")).toBeInTheDocument();
		expect(screen.getByText("tournament actions")).toBeInTheDocument();
	});

	it("calls onEdit when Edit is clicked", async () => {
		const user = userEvent.setup();
		const h = setup();
		await user.click(screen.getByText("Edit cash game"));
		expect(h.onEdit).toHaveBeenCalledTimes(1);
	});

	it("calls onArchive when Archive is clicked on an active target", async () => {
		const user = userEvent.setup();
		const h = setup({ isArchived: false });
		await user.click(screen.getByText("Archive cash game"));
		expect(h.onArchive).toHaveBeenCalledTimes(1);
		expect(h.onRestore).not.toHaveBeenCalled();
	});

	it("calls onRestore when Restore is clicked on an archived target", async () => {
		const user = userEvent.setup();
		const h = setup({ isArchived: true });
		await user.click(screen.getByText("Restore cash game"));
		expect(h.onRestore).toHaveBeenCalledTimes(1);
		expect(h.onArchive).not.toHaveBeenCalled();
	});

	it("calls onDelete when Delete is clicked", async () => {
		const user = userEvent.setup();
		const h = setup();
		await user.click(screen.getByText("Delete cash game"));
		expect(h.onDelete).toHaveBeenCalledTimes(1);
	});

	it("renders nothing when closed", () => {
		setup({ open: false });
		expect(screen.queryByText("Edit cash game")).not.toBeInTheDocument();
	});
});
