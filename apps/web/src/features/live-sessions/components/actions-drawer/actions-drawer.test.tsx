import { IconBolt, IconTrash } from "@tabler/icons-react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { ActionsDrawer } from "@/features/live-sessions/components/actions-drawer";

function setup(
	overrides: Partial<React.ComponentProps<typeof ActionsDrawer>> = {}
) {
	const props: React.ComponentProps<typeof ActionsDrawer> = {
		description: "Pick an action.",
		items: [],
		onOpenChange: vi.fn(),
		open: true,
		title: "Test actions",
		...overrides,
	};
	render(<ActionsDrawer {...props} />);
	return props;
}

describe("ActionsDrawer", () => {
	it("renders nothing visible when closed", () => {
		setup({
			open: false,
			items: [{ icon: IconBolt, label: "Record stack", onSelect: vi.fn() }],
		});
		expect(screen.queryByText("Record stack")).not.toBeInTheDocument();
	});

	it("renders the sr-only title and description for a11y", () => {
		setup();
		expect(screen.getByText("Test actions")).toBeInTheDocument();
		expect(screen.getByText("Pick an action.")).toBeInTheDocument();
	});

	it("renders one button per item with its label, in the given order", () => {
		setup({
			items: [
				{ icon: IconBolt, label: "First", onSelect: vi.fn() },
				{ icon: IconBolt, label: "Second", onSelect: vi.fn() },
				{ icon: IconTrash, label: "Third", onSelect: vi.fn() },
			],
		});
		const buttons = screen.getAllByRole("button");
		expect(buttons.map((b) => b.textContent)).toEqual([
			"First",
			"Second",
			"Third",
		]);
	});

	it("invokes the tapped item's onSelect exactly once and not the others", async () => {
		const user = userEvent.setup();
		const first = vi.fn();
		const second = vi.fn();
		setup({
			items: [
				{ icon: IconBolt, label: "First", onSelect: first },
				{ icon: IconBolt, label: "Second", onSelect: second },
			],
		});
		await user.click(screen.getByRole("button", { name: "Second" }));
		expect(second).toHaveBeenCalledTimes(1);
		expect(first).not.toHaveBeenCalled();
	});

	it("styles destructive items with the destructive text color", () => {
		setup({
			items: [
				{ icon: IconBolt, label: "Neutral", onSelect: vi.fn() },
				{
					icon: IconTrash,
					label: "Discard session",
					onSelect: vi.fn(),
					tone: "destructive",
				},
			],
		});
		expect(
			screen.getByRole("button", { name: "Discard session" }).className
		).toContain("text-destructive");
		expect(
			screen.getByRole("button", { name: "Neutral" }).className
		).not.toContain("text-destructive");
	});

	it("shows the empty message when there are no items and one is provided", () => {
		setup({ emptyMessage: "No players seated yet." });
		expect(screen.getByText("No players seated yet.")).toBeInTheDocument();
	});

	it("renders no empty message when items exist", () => {
		setup({
			emptyMessage: "No players seated yet.",
			items: [{ icon: IconBolt, label: "First", onSelect: vi.fn() }],
		});
		expect(
			screen.queryByText("No players seated yet.")
		).not.toBeInTheDocument();
	});
});
