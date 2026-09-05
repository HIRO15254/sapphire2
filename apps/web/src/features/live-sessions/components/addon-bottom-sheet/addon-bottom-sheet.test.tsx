import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AddonBottomSheet } from "./addon-bottom-sheet";

const AMOUNT_LABEL_PATTERN = /^amount\b/i;
const ADD_LABEL = "Add chips (+)";
const WITHDRAW_LABEL = "Withdraw (−)";
const HINT_TEXT =
	"Additions count toward total buy-in; withdrawals count toward the result. 0 cannot be logged.";

vi.mock("@/shared/components/bottom-sheet", () => ({
	BottomSheet: ({
		children,
		confirmLabel,
		formId,
		open,
		title,
	}: {
		children: ReactNode;
		confirmLabel?: string;
		formId?: string;
		open: boolean;
		title: string;
	}) =>
		open ? (
			<div>
				<h2>{title}</h2>
				{children}
				<button aria-label="Save" form={formId} type="submit">
					{confirmLabel}
				</button>
			</div>
		) : null,
}));

describe("AddonBottomSheet", () => {
	it("submits create-mode values via the sheet Save button", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(
			<AddonBottomSheet onOpenChange={vi.fn()} onSubmit={onSubmit} open />
		);

		expect(
			screen.getByRole("heading", { name: "Chip adjust" })
		).toBeInTheDocument();
		await user.type(screen.getByLabelText(AMOUNT_LABEL_PATTERN), "1500");
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith({ amount: 1500 });
	});

	it("shows edit-mode title", () => {
		render(
			<AddonBottomSheet
				initialAmount={2000}
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
			/>
		);
		expect(screen.getByText("Edit chip adjust")).toBeInTheDocument();
		expect(screen.getByDisplayValue("2000")).toBeInTheDocument();
	});

	it("renders no delete action when onDelete is not provided", () => {
		render(<AddonBottomSheet onOpenChange={vi.fn()} onSubmit={vi.fn()} open />);
		expect(
			screen.queryByRole("button", { name: "Delete this event" })
		).not.toBeInTheDocument();
	});

	it("renders the delete action as an outlined destructive button with a trash icon", async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		render(
			<AddonBottomSheet
				initialAmount={2000}
				onDelete={onDelete}
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
			/>
		);
		const deleteButton = screen.getByRole("button", {
			name: "Delete this event",
		});
		expect(deleteButton.className).toContain("border-destructive");
		expect(deleteButton.className).toContain("text-destructive");
		expect(deleteButton.querySelector("svg")).not.toBeNull();
		await user.click(deleteButton);
		expect(onDelete).toHaveBeenCalledTimes(1);
	});

	it("renders both direction pills with Add chips (+) selected by default", () => {
		render(<AddonBottomSheet onOpenChange={vi.fn()} onSubmit={vi.fn()} open />);
		expect(screen.getByRole("button", { name: ADD_LABEL })).toHaveAttribute(
			"aria-pressed",
			"true"
		);
		expect(
			screen.getByRole("button", { name: WITHDRAW_LABEL })
		).toHaveAttribute("aria-pressed", "false");
	});

	it("seeds the Withdraw (−) pill as selected for a negative initialAmount", () => {
		render(
			<AddonBottomSheet
				initialAmount={-2000}
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
			/>
		);
		expect(screen.getByDisplayValue("2000")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: WITHDRAW_LABEL })
		).toHaveAttribute("aria-pressed", "true");
	});

	it("logs a negative amount when Withdraw (−) is selected before submit", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(
			<AddonBottomSheet onOpenChange={vi.fn()} onSubmit={onSubmit} open />
		);

		await user.type(screen.getByLabelText(AMOUNT_LABEL_PATTERN), "800");
		await user.click(screen.getByRole("button", { name: WITHDRAW_LABEL }));
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith({ amount: -800 });
	});

	it("renders the hint about additions, withdrawals, and zero", () => {
		render(<AddonBottomSheet onOpenChange={vi.fn()} onSubmit={vi.fn()} open />);
		expect(screen.getByText(HINT_TEXT)).toBeInTheDocument();
	});
});
