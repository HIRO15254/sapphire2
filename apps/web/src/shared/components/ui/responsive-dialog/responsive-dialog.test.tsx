import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResponsiveDialog } from "./responsive-dialog";

const mockUseMediaQuery = vi.hoisted(() => vi.fn());

vi.mock("@/shared/hooks/use-media-query", () => ({
	useMediaQuery: mockUseMediaQuery,
}));

describe("ResponsiveDialog", () => {
	it("renders description in desktop mode", () => {
		mockUseMediaQuery.mockReturnValue(true);

		render(
			<ResponsiveDialog
				description="Desktop description"
				onOpenChange={vi.fn()}
				open
				title="Desktop Title"
			>
				<div>Desktop content</div>
			</ResponsiveDialog>
		);

		expect(screen.getByText("Desktop Title")).toBeInTheDocument();
		expect(screen.getByText("Desktop description")).toBeInTheDocument();
		expect(screen.getByText("Desktop content")).toBeInTheDocument();
	});

	it("renders description in mobile mode", () => {
		mockUseMediaQuery.mockReturnValue(false);

		render(
			<ResponsiveDialog
				description="Mobile description"
				onOpenChange={vi.fn()}
				open
				title="Mobile Title"
			>
				<div>Mobile content</div>
			</ResponsiveDialog>
		);

		expect(screen.getByText("Mobile Title")).toBeInTheDocument();
		expect(screen.getByText("Mobile description")).toBeInTheDocument();
		expect(screen.getByText("Mobile content")).toBeInTheDocument();
	});

	it("omits the description when none is provided", () => {
		mockUseMediaQuery.mockReturnValue(true);

		render(
			<ResponsiveDialog onOpenChange={vi.fn()} open title="No Description">
				<div>Dialog content</div>
			</ResponsiveDialog>
		);

		expect(screen.getByText("No Description")).toBeInTheDocument();
		expect(screen.queryByText("Desktop description")).not.toBeInTheDocument();
		expect(screen.getByText("Dialog content")).toBeInTheDocument();
	});

	describe("primaryAction (desktop)", () => {
		it("renders Cancel + Save buttons in a footer when primaryAction is set", () => {
			mockUseMediaQuery.mockReturnValue(true);
			render(
				<ResponsiveDialog
					onOpenChange={vi.fn()}
					open
					primaryAction={{ label: "Save" }}
					title="With action"
				>
					<div>body</div>
				</ResponsiveDialog>
			);
			expect(
				screen.getByRole("button", { name: "Cancel" })
			).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
		});

		it("uses the custom cancel label when provided", () => {
			mockUseMediaQuery.mockReturnValue(true);
			render(
				<ResponsiveDialog
					cancelLabel="Dismiss"
					onOpenChange={vi.fn()}
					open
					primaryAction={{ label: "Save" }}
					title="With action"
				>
					<div>body</div>
				</ResponsiveDialog>
			);
			expect(
				screen.getByRole("button", { name: "Dismiss" })
			).toBeInTheDocument();
		});

		it("calls onOpenChange(false) when Cancel is clicked", async () => {
			const user = userEvent.setup();
			mockUseMediaQuery.mockReturnValue(true);
			const onOpenChange = vi.fn();
			render(
				<ResponsiveDialog
					onOpenChange={onOpenChange}
					open
					primaryAction={{ label: "Save" }}
					title="With action"
				>
					<div>body</div>
				</ResponsiveDialog>
			);
			await user.click(screen.getByRole("button", { name: "Cancel" }));
			expect(onOpenChange).toHaveBeenCalledTimes(1);
			expect(onOpenChange).toHaveBeenCalledWith(false);
		});

		it("renders Save as a submit button targeting the supplied form id", () => {
			mockUseMediaQuery.mockReturnValue(true);
			render(
				<ResponsiveDialog
					onOpenChange={vi.fn()}
					open
					primaryAction={{ form: "external-form", label: "Save" }}
					title="With action"
				>
					<div>body</div>
				</ResponsiveDialog>
			);
			const save = screen.getByRole("button", { name: "Save" });
			expect(save).toHaveAttribute("type", "submit");
			expect(save).toHaveAttribute("form", "external-form");
		});

		it("renders Save as a regular button when no form id is provided", () => {
			mockUseMediaQuery.mockReturnValue(true);
			render(
				<ResponsiveDialog
					onOpenChange={vi.fn()}
					open
					primaryAction={{ label: "Delete", onClick: vi.fn() }}
					title="With action"
				>
					<div>body</div>
				</ResponsiveDialog>
			);
			const save = screen.getByRole("button", { name: "Delete" });
			expect(save).toHaveAttribute("type", "button");
		});

		it("disables Save when isLoading is true and swaps the label", () => {
			mockUseMediaQuery.mockReturnValue(true);
			render(
				<ResponsiveDialog
					onOpenChange={vi.fn()}
					open
					primaryAction={{ isLoading: true, label: "Save" }}
					title="With action"
				>
					<div>body</div>
				</ResponsiveDialog>
			);
			const save = screen.getByRole("button", { name: "Saving..." });
			expect(save).toBeDisabled();
		});

		it("uses the custom loadingLabel when provided", () => {
			mockUseMediaQuery.mockReturnValue(true);
			render(
				<ResponsiveDialog
					onOpenChange={vi.fn()}
					open
					primaryAction={{
						isLoading: true,
						label: "Save",
						loadingLabel: "Working...",
					}}
					title="With action"
				>
					<div>body</div>
				</ResponsiveDialog>
			);
			expect(
				screen.getByRole("button", { name: "Working..." })
			).toBeInTheDocument();
		});

		it("disables Save when the disabled flag is set", () => {
			mockUseMediaQuery.mockReturnValue(true);
			render(
				<ResponsiveDialog
					onOpenChange={vi.fn()}
					open
					primaryAction={{ disabled: true, label: "Save" }}
					title="With action"
				>
					<div>body</div>
				</ResponsiveDialog>
			);
			expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
		});

		it("forwards onClick when Save is clicked", async () => {
			const user = userEvent.setup();
			mockUseMediaQuery.mockReturnValue(true);
			const onClick = vi.fn();
			render(
				<ResponsiveDialog
					onOpenChange={vi.fn()}
					open
					primaryAction={{ label: "Delete", onClick }}
					title="With action"
				>
					<div>body</div>
				</ResponsiveDialog>
			);
			await user.click(screen.getByRole("button", { name: "Delete" }));
			expect(onClick).toHaveBeenCalledTimes(1);
		});

		it("does not render the footer when primaryAction is absent", () => {
			mockUseMediaQuery.mockReturnValue(true);
			render(
				<ResponsiveDialog onOpenChange={vi.fn()} open title="No action">
					<div>body</div>
				</ResponsiveDialog>
			);
			expect(
				screen.queryByRole("button", { name: "Cancel" })
			).not.toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: "Save" })
			).not.toBeInTheDocument();
		});
	});

	describe("forceDialog", () => {
		it("renders the centered Dialog branch even when the viewport is mobile", () => {
			mockUseMediaQuery.mockReturnValue(false);
			render(
				<ResponsiveDialog
					forceDialog
					onOpenChange={vi.fn()}
					open
					primaryAction={{ label: "Delete", variant: "destructive" }}
					title="Confirm"
				>
					<div>body</div>
				</ResponsiveDialog>
			);
			// Mobile drawer would render a sheet toolbar with the labeled Cancel
			// + Save buttons; the Dialog branch renders a Cancel/Save FOOTER and
			// no drawer-style chrome.
			expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute(
				"data-variant",
				"destructive"
			);
			expect(
				screen.getByRole("button", { name: "Cancel" })
			).toBeInTheDocument();
		});
	});

	describe("primaryAction (mobile drawer)", () => {
		it("renders Cancel top-left and Save top-right, hiding the X close", () => {
			mockUseMediaQuery.mockReturnValue(false);
			render(
				<ResponsiveDialog
					onOpenChange={vi.fn()}
					open
					primaryAction={{ label: "Save" }}
					title="Mobile action"
				>
					<div>body</div>
				</ResponsiveDialog>
			);
			expect(
				screen.getByRole("button", { name: "Cancel" })
			).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
			expect(screen.queryByText("Close")).not.toBeInTheDocument();
		});

		it("keeps the X close button when primaryAction is absent", () => {
			mockUseMediaQuery.mockReturnValue(false);
			render(
				<ResponsiveDialog onOpenChange={vi.fn()} open title="No action">
					<div>body</div>
				</ResponsiveDialog>
			);
			expect(screen.getByText("Close")).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: "Cancel" })
			).not.toBeInTheDocument();
		});

		it("Save is a submit button when form id is given (mobile)", () => {
			mockUseMediaQuery.mockReturnValue(false);
			render(
				<ResponsiveDialog
					onOpenChange={vi.fn()}
					open
					primaryAction={{ form: "x", label: "Save" }}
					title="Mobile action"
				>
					<div>body</div>
				</ResponsiveDialog>
			);
			const save = screen.getByRole("button", { name: "Save" });
			expect(save).toHaveAttribute("form", "x");
			expect(save).toHaveAttribute("type", "submit");
		});

		it("disables Save while loading on mobile", () => {
			mockUseMediaQuery.mockReturnValue(false);
			render(
				<ResponsiveDialog
					onOpenChange={vi.fn()}
					open
					primaryAction={{ isLoading: true, label: "Save" }}
					title="Mobile action"
				>
					<div>body</div>
				</ResponsiveDialog>
			);
			expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
		});

		it("applies the primary text color to Save by default", () => {
			mockUseMediaQuery.mockReturnValue(false);
			render(
				<ResponsiveDialog
					onOpenChange={vi.fn()}
					open
					primaryAction={{ label: "Save" }}
					title="Mobile action"
				>
					<div>body</div>
				</ResponsiveDialog>
			);
			expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
				"text-primary"
			);
		});

		it("applies the destructive text color when variant is destructive", () => {
			mockUseMediaQuery.mockReturnValue(false);
			render(
				<ResponsiveDialog
					onOpenChange={vi.fn()}
					open
					primaryAction={{ label: "Delete", variant: "destructive" }}
					title="Mobile action"
				>
					<div>body</div>
				</ResponsiveDialog>
			);
			expect(screen.getByRole("button", { name: "Delete" })).toHaveClass(
				"text-destructive"
			);
		});
	});

	describe("primaryAction (desktop) — destructive variant", () => {
		it("renders Save with destructive variant in the desktop footer", () => {
			mockUseMediaQuery.mockReturnValue(true);
			render(
				<ResponsiveDialog
					onOpenChange={vi.fn()}
					open
					primaryAction={{ label: "Delete", variant: "destructive" }}
					title="With destructive action"
				>
					<div>body</div>
				</ResponsiveDialog>
			);
			expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute(
				"data-variant",
				"destructive"
			);
		});

		it("renders Save with the default variant otherwise", () => {
			mockUseMediaQuery.mockReturnValue(true);
			render(
				<ResponsiveDialog
					onOpenChange={vi.fn()}
					open
					primaryAction={{ label: "Save" }}
					title="With action"
				>
					<div>body</div>
				</ResponsiveDialog>
			);
			expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
				"data-variant",
				"default"
			);
		});
	});
});
