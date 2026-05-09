import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ChipPurchaseSheet } from "./chip-purchase-sheet";

const OPTIONS = [
	{ id: 1, name: "Rebuy", cost: 2000, chips: 15_000 },
	{ id: 2, name: "Addon", cost: 3000, chips: 20_000 },
];

const PURCHASE_OPTION_RE = /Purchase Option/i;

vi.mock("@/shared/components/ui/responsive-dialog", () => ({
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
	it("renders title 'Chip Purchase'", () => {
		render(
			<ChipPurchaseSheet
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
				options={OPTIONS}
			/>
		);
		expect(
			screen.getByRole("heading", { name: "Chip Purchase" })
		).toBeInTheDocument();
	});

	it("renders option list in the select", () => {
		render(
			<ChipPurchaseSheet
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
				options={OPTIONS}
			/>
		);
		expect(screen.getByText(PURCHASE_OPTION_RE)).toBeInTheDocument();
	});

	it("does not submit when no option is selected", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		render(
			<ChipPurchaseSheet
				onOpenChange={vi.fn()}
				onSubmit={onSubmit}
				open
				options={OPTIONS}
			/>
		);
		await user.click(screen.getByRole("button", { name: "Add Purchase" }));
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("invokes onOpenChange(false) when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		render(
			<ChipPurchaseSheet
				onOpenChange={onOpenChange}
				onSubmit={vi.fn()}
				open
				options={OPTIONS}
			/>
		);
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("renders empty state when no options are available", () => {
		render(
			<ChipPurchaseSheet
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
				options={[]}
			/>
		);
		expect(
			screen.getByRole("heading", { name: "Chip Purchase" })
		).toBeInTheDocument();
	});
});
