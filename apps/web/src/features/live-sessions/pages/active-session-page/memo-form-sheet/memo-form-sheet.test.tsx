import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoFormSheet } from "./memo-form-sheet";

const NOTE_TEXTBOX_LABEL_PATTERN = /note/i;

describe("MemoFormSheet", () => {
	it("renders nothing visible when closed", () => {
		render(
			<MemoFormSheet onOpenChange={vi.fn()} onSubmit={vi.fn()} open={false} />
		);
		expect(
			screen.queryByRole("textbox", { name: NOTE_TEXTBOX_LABEL_PATTERN })
		).not.toBeInTheDocument();
	});

	it("shows the Note title and a Log confirm button when open", () => {
		render(<MemoFormSheet onOpenChange={vi.fn()} onSubmit={vi.fn()} open />);
		expect(screen.getByRole("heading", { name: "Note" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Log" })).toBeInTheDocument();
	});

	it("closes via onOpenChange(false) exactly once when Cancel is tapped", async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		render(
			<MemoFormSheet onOpenChange={onOpenChange} onSubmit={vi.fn()} open />
		);
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenNthCalledWith(1, false);
	});

	it("submits the entered text via the Log confirm button", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		render(<MemoFormSheet onOpenChange={vi.fn()} onSubmit={onSubmit} open />);
		await user.type(
			screen.getByRole("textbox", { name: NOTE_TEXTBOX_LABEL_PATTERN }),
			"vs UTG 3bet pot"
		);
		await user.click(screen.getByRole("button", { name: "Log" }));
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenNthCalledWith(1, "vs UTG 3bet pot");
	});

	it("rejects an empty memo and does not call onSubmit", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		render(<MemoFormSheet onOpenChange={vi.fn()} onSubmit={onSubmit} open />);
		await user.click(screen.getByRole("button", { name: "Log" }));
		expect(onSubmit).not.toHaveBeenCalled();
	});
});
