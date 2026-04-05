import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ChipPurchaseSheet } from "../chip-purchase-sheet";

const NAME_LABEL_PATTERN = /name/i;
const COST_LABEL_PATTERN = /cost/i;
const CHIPS_RECEIVED_LABEL_PATTERN = /chips received/i;

vi.mock("@/components/ui/responsive-dialog", () => ({
	ResponsiveDialog: ({
		children,
		open,
		title,
	}: {
		children: ReactNode;
		open: boolean;
		title: string;
	}) =>
		open ? (
			<div>
				<h2>{title}</h2>
				{children}
			</div>
		) : null,
}));

describe("ChipPurchaseSheet", () => {
	it("submits create-mode values", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(
			<ChipPurchaseSheet onOpenChange={vi.fn()} onSubmit={onSubmit} open />
		);

		expect(
			screen.getByRole("heading", { name: "Add Chip Purchase" })
		).toBeInTheDocument();
		await user.type(screen.getByLabelText(NAME_LABEL_PATTERN), "Rebuy");
		await user.clear(screen.getByLabelText(COST_LABEL_PATTERN));
		await user.type(screen.getByLabelText(COST_LABEL_PATTERN), "2000");
		await user.clear(screen.getByLabelText(CHIPS_RECEIVED_LABEL_PATTERN));
		await user.type(
			screen.getByLabelText(CHIPS_RECEIVED_LABEL_PATTERN),
			"15000"
		);
		await user.click(screen.getByRole("button", { name: "Add Chip Purchase" }));

		expect(onSubmit).toHaveBeenCalledWith({
			chips: 15_000,
			cost: 2000,
			name: "Rebuy",
		});
	});

	it("renders read-only mode without a submit button and keeps delete available", () => {
		render(
			<ChipPurchaseSheet
				initialValues={{ chips: 10_000, cost: 1500, name: "Addon" }}
				onDelete={vi.fn()}
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
				readOnly
			/>
		);

		expect(screen.getByText("Addon")).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Save" })
		).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
		expect(screen.getByLabelText(NAME_LABEL_PATTERN)).toBeDisabled();
		expect(screen.getByLabelText(COST_LABEL_PATTERN)).toBeDisabled();
		expect(screen.getByLabelText(CHIPS_RECEIVED_LABEL_PATTERN)).toBeDisabled();
	});
});
