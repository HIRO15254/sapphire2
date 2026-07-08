import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteVariantDialog } from "../delete-variant-dialog";

const SHORT_DECK_RE = /Short Deck/;

function setup(
	props: Partial<React.ComponentProps<typeof DeleteVariantDialog>> = {}
) {
	const onConfirm = vi.fn();
	const onOpenChange = vi.fn();
	render(
		<DeleteVariantDialog
			name="PLO5"
			onConfirm={onConfirm}
			onOpenChange={onOpenChange}
			open
			{...props}
		/>
	);
	return { onConfirm, onOpenChange };
}

describe("DeleteVariantDialog", () => {
	it("renders the confirmation title", () => {
		setup();
		expect(screen.getByText("Delete this game variant?")).toBeInTheDocument();
	});

	it("names the variant in the description", () => {
		setup({ name: "Short Deck" });
		expect(screen.getByText(SHORT_DECK_RE)).toBeInTheDocument();
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
			screen.queryByText("Delete this game variant?")
		).not.toBeInTheDocument();
	});
});
