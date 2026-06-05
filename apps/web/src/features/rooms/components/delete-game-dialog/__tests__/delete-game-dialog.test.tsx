import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteGameDialog } from "../delete-game-dialog";

const NAME_RE = /Sunday Major/;

function setup(
	props: Partial<React.ComponentProps<typeof DeleteGameDialog>> = {}
) {
	const onConfirm = vi.fn();
	const onOpenChange = vi.fn();
	render(
		<DeleteGameDialog
			label="cash game"
			name="1/2 NLH"
			onConfirm={onConfirm}
			onOpenChange={onOpenChange}
			open
			{...props}
		/>
	);
	return { onConfirm, onOpenChange };
}

describe("DeleteGameDialog", () => {
	it("renders a title with the entity label", () => {
		setup();
		expect(screen.getByText("Delete this cash game?")).toBeInTheDocument();
	});

	it("names the entity in the description", () => {
		setup({ name: "Sunday Major", label: "tournament" });
		expect(screen.getByText(NAME_RE)).toBeInTheDocument();
		expect(screen.getByText("Delete this tournament?")).toBeInTheDocument();
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
		expect(
			screen.queryByText("Delete this cash game?")
		).not.toBeInTheDocument();
	});
});
