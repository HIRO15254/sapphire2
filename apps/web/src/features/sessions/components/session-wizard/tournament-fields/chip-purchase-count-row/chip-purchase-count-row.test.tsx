import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChipPurchaseCountRow } from "./chip-purchase-count-row";

const row = {
	uid: "row-1",
	name: "Rebuy",
	cost: "1.5",
	chips: "1000",
};

describe("ChipPurchaseCountRow", () => {
	it("treats a non-integer cost as zero instead of truncating it", () => {
		render(
			<ChipPurchaseCountRow
				count={2}
				disabled={false}
				onCountChange={vi.fn()}
				row={row}
			/>
		);

		expect(screen.getByText("× 0 = 0")).toBeInTheDocument();
	});

	it("treats a negative cost as zero", () => {
		render(
			<ChipPurchaseCountRow
				count={2}
				disabled={false}
				onCountChange={vi.fn()}
				row={{ ...row, cost: "-1" }}
			/>
		);

		expect(screen.getByText("× 0 = 0")).toBeInTheDocument();
	});

	it.each([
		"1.5",
		"12abc",
		"Infinity",
		"9007199254740992",
	])("maps invalid count input %s to zero", (value) => {
		const onCountChange = vi.fn();
		render(
			<ChipPurchaseCountRow
				count={0}
				disabled={false}
				onCountChange={onCountChange}
				row={{ ...row, cost: "50" }}
			/>
		);

		fireEvent.change(screen.getByRole("textbox"), {
			target: { value },
		});

		expect(onCountChange).toHaveBeenCalledTimes(1);
		expect(onCountChange).toHaveBeenCalledWith(0);
	});
});
