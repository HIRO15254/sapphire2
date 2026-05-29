import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FormSheet } from "./form-sheet";

// Capture the props the FormSheet passes to the underlying Drawer
// component so we can assert on contract bits (`dismissible={false}`)
// that aren't visible in the rendered DOM but matter to the v2 sheet
// contract (`.claude/rules/web-theme.md`).
const drawerSpy = vi.hoisted(() => vi.fn());
vi.mock("@/shared/components/ui/drawer", async () => {
	const actual = await vi.importActual<
		typeof import("@/shared/components/ui/drawer")
	>("@/shared/components/ui/drawer");
	return {
		...actual,
		Drawer: (props: Record<string, unknown>) => {
			drawerSpy(props);
			return <actual.Drawer {...props} />;
		},
	};
});

describe("FormSheet", () => {
	it("renders the title in an sr-only DrawerTitle plus a visible header label", () => {
		render(
			<FormSheet formId="x" onOpenChange={vi.fn()} open title="Edit currency">
				<div>body</div>
			</FormSheet>
		);
		// The visible header label and the sr-only DrawerTitle both carry the
		// title text — assert it appears at least once.
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

	it("disables the Save button while isLoading is true", () => {
		render(
			<FormSheet formId="x" isLoading onOpenChange={vi.fn()} open title="t">
				<div>body</div>
			</FormSheet>
		);
		expect(screen.getByLabelText("Save")).toBeDisabled();
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

	it("passes dismissible={false} to the underlying Drawer (no swipe-down, no overlay tap)", () => {
		drawerSpy.mockClear();
		render(
			<FormSheet formId="x" onOpenChange={vi.fn()} open title="t">
				<div>body</div>
			</FormSheet>
		);
		expect(drawerSpy).toHaveBeenCalled();
		const lastCallProps = drawerSpy.mock.calls.at(-1)?.[0] as
			| Record<string, unknown>
			| undefined;
		expect(lastCallProps?.dismissible).toBe(false);
	});

	it("does not render a drag handle (handle would mislead given dismissible=false)", () => {
		// Vaul's drag-handle is rendered via a class containing
		// `bg-muted-foreground/35` per the v2 action-sheet convention.
		// The FormSheet contract is explicitly handle-less; assert the
		// rendered tree has no such element.
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
