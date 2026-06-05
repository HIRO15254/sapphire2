import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	type ChipPurchaseRow,
	ChipPurchasesEditor,
} from "../chip-purchases-editor";

function row(overrides: Partial<ChipPurchaseRow> = {}): ChipPurchaseRow {
	return { uid: "u1", name: "Rebuy", cost: "50", chips: "10000", ...overrides };
}

describe("ChipPurchasesEditor", () => {
	it("renders the Add button and no rows when value is empty", () => {
		render(<ChipPurchasesEditor onChange={vi.fn()} value={[]} />);
		expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
		expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
	});

	it("appends a blank row when Add is clicked", () => {
		const onChange = vi.fn();
		render(<ChipPurchasesEditor onChange={onChange} value={[]} />);
		fireEvent.click(screen.getByRole("button", { name: "Add" }));
		expect(onChange).toHaveBeenCalledTimes(1);
		const next = onChange.mock.calls[0][0] as ChipPurchaseRow[];
		expect(next).toHaveLength(1);
		expect(next[0]).toMatchObject({ name: "", cost: "", chips: "" });
		expect(next[0].uid).toBeTruthy();
	});

	it("renders existing rows with their values", () => {
		render(<ChipPurchasesEditor onChange={vi.fn()} value={[row()]} />);
		expect(screen.getByLabelText("Name")).toHaveValue("Rebuy");
		expect(screen.getByLabelText("Cost")).toHaveValue("50");
		expect(screen.getByLabelText("Chips")).toHaveValue("10000");
	});

	it("patches the name cell on edit", () => {
		const onChange = vi.fn();
		render(<ChipPurchasesEditor onChange={onChange} value={[row()]} />);
		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "Add-on" },
		});
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith([row({ name: "Add-on" })]);
	});

	it("patches the cost cell on edit", () => {
		const onChange = vi.fn();
		render(<ChipPurchasesEditor onChange={onChange} value={[row()]} />);
		fireEvent.change(screen.getByLabelText("Cost"), {
			target: { value: "75" },
		});
		expect(onChange).toHaveBeenCalledWith([row({ cost: "75" })]);
	});

	it("removes the targeted row", () => {
		const onChange = vi.fn();
		render(
			<ChipPurchasesEditor
				onChange={onChange}
				value={[row({ uid: "u1" }), row({ uid: "u2", name: "Add-on" })]}
			/>
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Remove chip purchase 1" })
		);
		expect(onChange).toHaveBeenCalledWith([row({ uid: "u2", name: "Add-on" })]);
	});
});
