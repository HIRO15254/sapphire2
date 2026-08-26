import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { BottomSheet } from "@/shared/components/bottom-sheet";
import { CRYST_SCOPE } from "@/shared/lib/theme";

function setup(
	overrides: Partial<React.ComponentProps<typeof BottomSheet>> = {}
) {
	const props: React.ComponentProps<typeof BottomSheet> = {
		children: <div>Sheet body</div>,
		onOpenChange: vi.fn(),
		open: true,
		title: "Test sheet",
		...overrides,
	};
	render(<BottomSheet {...props} />);
	return props;
}

describe("BottomSheet", () => {
	it("renders nothing visible when closed", () => {
		setup({ open: false });
		expect(screen.queryByText("Sheet body")).not.toBeInTheDocument();
	});

	it("renders the centered title and the body when open", () => {
		setup();
		expect(
			screen.getByRole("heading", { name: "Test sheet" })
		).toBeInTheDocument();
		expect(screen.getByText("Sheet body")).toBeInTheDocument();
	});

	it("applies the cryst scope class to the portaled content", () => {
		setup();
		const dialog = screen.getByRole("dialog");
		expect(dialog.className).toContain(CRYST_SCOPE);
	});

	it("renders no cancel button by default", () => {
		setup();
		expect(
			screen.queryByRole("button", { name: "Cancel" })
		).not.toBeInTheDocument();
	});

	it("invokes onCancel exactly once when the cancel button is tapped", async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();
		setup({ cancelLabel: "Cancel", onCancel });
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it("closes via onOpenChange(false) when cancel is tapped without onCancel", async () => {
		const user = userEvent.setup();
		const props = setup({ cancelLabel: "Close" });
		await user.click(screen.getByRole("button", { name: "Close" }));
		expect(props.onOpenChange).toHaveBeenCalledTimes(1);
		expect(props.onOpenChange).toHaveBeenNthCalledWith(1, false);
	});

	it("renders no confirm button when neither onConfirm nor formId is given", () => {
		setup({ confirmLabel: "Save" });
		expect(
			screen.queryByRole("button", { name: "Save" })
		).not.toBeInTheDocument();
	});

	it("invokes onConfirm exactly once when the confirm button is tapped", async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		setup({ confirmLabel: "Save", onConfirm });
		await user.click(screen.getByRole("button", { name: "Save" }));
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("submits the external form via the formId confirm button", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
		render(
			<>
				<form id="target-form" onSubmit={onSubmit} />
				<BottomSheet
					confirmLabel="Log"
					formId="target-form"
					onOpenChange={vi.fn()}
					open
					title="Form sheet"
				>
					<div>Body</div>
				</BottomSheet>
			</>
		);
		const confirm = screen.getByRole("button", { name: "Log" });
		expect(confirm).toHaveAttribute("form", "target-form");
		expect(confirm).toHaveAttribute("type", "submit");
		await user.click(confirm);
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});

	it("disables the confirm button when isConfirmDisabled", () => {
		setup({
			confirmLabel: "Save",
			isConfirmDisabled: true,
			onConfirm: vi.fn(),
		});
		expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
	});

	it("disables the confirm button while isConfirmPending", () => {
		setup({ confirmLabel: "Save", isConfirmPending: true, onConfirm: vi.fn() });
		expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
	});

	it("does not invoke a disabled confirm handler", async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		setup({ confirmLabel: "Save", isConfirmDisabled: true, onConfirm });
		await user.click(screen.getByRole("button", { name: "Save" }));
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it("renders the sr-only description for a11y", () => {
		setup({ description: "Pick an option." });
		expect(screen.getByText("Pick an option.")).toBeInTheDocument();
	});

	it("falls back to the title as the sr-only description", () => {
		setup();
		expect(screen.getAllByText("Test sheet").length).toBeGreaterThanOrEqual(2);
	});
});
