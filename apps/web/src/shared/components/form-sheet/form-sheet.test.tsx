import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FormSheet } from "./form-sheet";

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

	it.each([
		{ isSaveDisabled: true, isLoading: false, shouldBeDisabled: true },
		{ isSaveDisabled: false, isLoading: false, shouldBeDisabled: false },
		{ isSaveDisabled: false, isLoading: true, shouldBeDisabled: true },
	])("disables Save when isSaveDisabled=$isSaveDisabled or isLoading=$isLoading", ({
		isSaveDisabled,
		isLoading,
		shouldBeDisabled,
	}) => {
		render(
			<FormSheet
				formId="x"
				isLoading={isLoading}
				isSaveDisabled={isSaveDisabled}
				onOpenChange={vi.fn()}
				open
				title="t"
			>
				<div>body</div>
			</FormSheet>
		);
		expect(screen.getByLabelText("Save")).toHaveProperty(
			"disabled",
			shouldBeDisabled
		);
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
