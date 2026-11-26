import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FormSheet } from "./form-sheet";

describe("FormSheet", () => {
	it("renders the title in an sr-only DrawerTitle plus a visible header label", () => {
		render(
			<FormSheet formId="x" onOpenChange={vi.fn()} open title="Edit currency">
				<div>body</div>
			</FormSheet>
		);
		expect(screen.getAllByText("Edit currency").length).toBeGreaterThanOrEqual(
			1
		);
	});

	it("renders an X cancel button on the left", () => {
		render(
			<FormSheet formId="x" onOpenChange={vi.fn()} open title="t">
				<div>body</div>
			</FormSheet>
		);
		expect(screen.getByLabelText("Cancel")).toBeInTheDocument();
	});

	it("renders a checkmark Save button targeting the external form id", () => {
		render(
			<FormSheet formId="my-form" onOpenChange={vi.fn()} open title="t">
				<div>body</div>
			</FormSheet>
		);
		const save = screen.getByLabelText("Save");
		expect(save).toHaveAttribute("form", "my-form");
		expect(save).toHaveAttribute("type", "submit");
	});

	it("disables Save when an explicit save guard is active", () => {
		render(
			<FormSheet
				formId="x"
				isSaveDisabled
				onOpenChange={vi.fn()}
				open
				title="t"
			>
				<div>body</div>
			</FormSheet>
		);
		expect(screen.getByLabelText("Save")).toBeDisabled();
	});

	it("keeps Save enabled when loading and save guard are both false", () => {
		render(
			<FormSheet formId="x" onOpenChange={vi.fn()} open title="t">
				<div>body</div>
			</FormSheet>
		);
		expect(screen.getByLabelText("Save")).toBeEnabled();
	});

	it("disables the Save button while isLoading is true", () => {
		render(
			<FormSheet formId="x" isLoading onOpenChange={vi.fn()} open title="t">
				<div>body</div>
			</FormSheet>
		);
		expect(screen.getByLabelText("Save")).toBeDisabled();
	});

	it("marks the Save button busy while isLoading is true", () => {
		render(
			<FormSheet formId="x" isLoading onOpenChange={vi.fn()} open title="t">
				<div>body</div>
			</FormSheet>
		);
		expect(screen.getByLabelText("Save")).toHaveAttribute("aria-busy", "true");
	});

	it("calls onOpenChange(false) when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		render(
			<FormSheet formId="x" onOpenChange={onOpenChange} open title="t">
				<div>body</div>
			</FormSheet>
		);
		await user.click(screen.getByLabelText("Cancel"));
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("stays open when the user presses Escape or taps outside the sheet", async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		render(
			<FormSheet formId="x" onOpenChange={onOpenChange} open title="t">
				<div>body</div>
			</FormSheet>
		);

		const overlay = document.querySelector("[data-vaul-overlay]");
		if (!overlay) {
			throw new Error("FormSheet rendered no overlay");
		}

		await user.keyboard("{Escape}");
		await user.pointer({ keys: "[MouseLeft]", target: overlay });

		expect(onOpenChange).not.toHaveBeenCalled();
		expect(screen.getByText("body")).toBeVisible();
	});

	it("does not render a drag handle (handle would mislead given dismissible=false)", () => {
		const { container } = render(
			<FormSheet formId="x" onOpenChange={vi.fn()} open title="t">
				<div>body</div>
			</FormSheet>
		);
		expect(
			container.querySelector('[class*="bg-muted-foreground/35"]')
		).toBeNull();
	});

	it("renders the body children", () => {
		render(
			<FormSheet formId="x" onOpenChange={vi.fn()} open title="t">
				<div>form body content</div>
			</FormSheet>
		);
		expect(screen.getByText("form body content")).toBeInTheDocument();
	});
});
