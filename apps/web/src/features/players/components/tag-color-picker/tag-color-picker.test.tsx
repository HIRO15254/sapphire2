import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TAG_COLOR_NAMES } from "@/features/players/constants/player-tag-colors";
import { TagColorPicker } from "./tag-color-picker";

describe("TagColorPicker", () => {
	it("renders all 8 color swatches", () => {
		render(<TagColorPicker onChange={vi.fn()} value="gray" />);

		for (const color of TAG_COLOR_NAMES) {
			expect(
				screen.getByRole("radio", { name: `Select ${color} color` })
			).toBeInTheDocument();
		}
	});

	it("marks the selected swatch as checked", () => {
		render(<TagColorPicker onChange={vi.fn()} value="blue" />);

		expect(
			screen.getByRole("radio", { name: "Select blue color" })
		).toBeChecked();
	});

	it("marks unselected swatches as unchecked", () => {
		render(<TagColorPicker onChange={vi.fn()} value="blue" />);

		for (const color of TAG_COLOR_NAMES) {
			const input = screen.getByRole("radio", {
				name: `Select ${color} color`,
			});
			if (color === "blue") {
				expect(input).toBeChecked();
			} else {
				expect(input).not.toBeChecked();
			}
		}
	});

	it("calls onChange with the correct color name when a swatch is clicked", async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();

		render(<TagColorPicker onChange={onChange} value="gray" />);

		await user.click(screen.getByRole("radio", { name: "Select red color" }));
		expect(onChange).toHaveBeenCalledWith("red");
	});

	it("has aria-label on each swatch input", () => {
		render(<TagColorPicker onChange={vi.fn()} value="gray" />);

		for (const color of TAG_COLOR_NAMES) {
			expect(
				screen.getByLabelText(`Select ${color} color`)
			).toBeInTheDocument();
		}
	});

	it("clicking the currently selected swatch does not fire onChange (RadioGroup semantics)", async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();

		render(<TagColorPicker onChange={onChange} value="gray" />);

		await user.click(screen.getByRole("radio", { name: "Select gray color" }));
		expect(onChange).not.toHaveBeenCalled();
	});
});
