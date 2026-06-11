import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChipPurchaseSheet } from "./chip-purchase-sheet";

const OPTIONS = [
	{ id: "cp1", name: "Rebuy", cost: 2000, chips: 15_000 },
	{ id: "cp2", name: "Add-on", cost: 1000, chips: 8000 },
];

const REBUY_RE = /Rebuy/;
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
			screen.queryByRole("heading", { name: "Add Chip Purchase" })
		).not.toBeInTheDocument();
	});

	it("renders one button per rule-defined chip purchase", () => {
		render(
			<ChipPurchaseSheet
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
				options={OPTIONS}
			/>
		);
		expect(
			screen.getByRole("heading", { name: "Add Chip Purchase" })
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: REBUY_RE })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: ADDON_RE })).toBeInTheDocument();
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
		await user.click(screen.getByRole("button", { name: REBUY_RE }));
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith({
			sessionChipPurchaseId: "cp1",
			name: "Rebuy",
			cost: 2000,
			chips: 15_000,
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
