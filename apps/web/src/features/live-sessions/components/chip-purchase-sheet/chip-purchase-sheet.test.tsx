import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChipPurchaseSheet } from "./chip-purchase-sheet";

const OPTIONS = [
	{ id: "cp1", name: "Re-entry", cost: 10_000, chips: 30_000 },
	{ id: "cp2", name: "Add-on", cost: 5000, chips: 20_000 },
];

const REENTRY_RE = /Re-entry/;
const ADDON_RE = /Add-on/;
const EMPTY_STATE_RE = /No chip purchases are defined/i;

describe("ChipPurchaseSheet (picker)", () => {
	it("renders nothing when closed", () => {
		render(
			<ChipPurchaseSheet
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open={false}
				options={OPTIONS}
			/>
		);
		expect(
			screen.queryByRole("heading", { name: "Chip purchase" })
		).not.toBeInTheDocument();
	});

	it("renders the visible Chip purchase title and one row per rule-defined option", () => {
		render(
			<ChipPurchaseSheet
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
				options={OPTIONS}
			/>
		);
		expect(
			screen.getByRole("heading", { name: "Chip purchase" })
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: REENTRY_RE })
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: ADDON_RE })).toBeInTheDocument();
	});

	it("shows the chip count meta and the cost in mono for each row", () => {
		render(
			<ChipPurchaseSheet
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
				options={OPTIONS}
			/>
		);
		expect(screen.getByText("+30,000chips")).toBeInTheDocument();
		const costValue = screen.getByText("10,000");
		expect(costValue.className).toContain("font-mono");
	});

	it("submits the picked option with its sessionChipPurchaseId", async () => {
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
		await user.click(screen.getByRole("button", { name: REENTRY_RE }));
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenNthCalledWith(1, {
			sessionChipPurchaseId: "cp1",
			name: "Re-entry",
			cost: 10_000,
			chips: 30_000,
		});
	});

	it("shows an empty-state message when no chip purchases are defined", () => {
		render(
			<ChipPurchaseSheet
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
				options={[]}
			/>
		);
		expect(screen.getByText(EMPTY_STATE_RE)).toBeInTheDocument();
	});
});
