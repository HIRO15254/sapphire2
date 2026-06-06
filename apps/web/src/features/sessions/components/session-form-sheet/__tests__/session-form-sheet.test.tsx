import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionFormSheet } from "@/features/sessions/components/session-form-sheet";

describe("SessionFormSheet", () => {
	it("renders the title and children when open", () => {
		render(
			<SessionFormSheet onOpenChange={vi.fn()} open={true} title="New session">
				<p>wizard body</p>
			</SessionFormSheet>
		);
		// Title appears as both the visible DrawerTitle and an sr-only description.
		expect(screen.getAllByText("New session").length).toBeGreaterThan(0);
		expect(screen.getByText("wizard body")).toBeInTheDocument();
	});

	it("requests close when the close button is pressed", async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		render(
			<SessionFormSheet
				onOpenChange={onOpenChange}
				open={true}
				title="New session"
			>
				<p>wizard body</p>
			</SessionFormSheet>
		);
		await user.click(screen.getByRole("button", { name: "Close" }));
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("renders no body when closed", () => {
		render(
			<SessionFormSheet onOpenChange={vi.fn()} open={false} title="New session">
				<p>wizard body</p>
			</SessionFormSheet>
		);
		expect(screen.queryByText("wizard body")).not.toBeInTheDocument();
	});
});
