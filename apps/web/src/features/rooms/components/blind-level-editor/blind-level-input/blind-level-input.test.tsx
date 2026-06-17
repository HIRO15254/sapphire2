import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BlindLevelInput } from "./blind-level-input";

describe("BlindLevelInput", () => {
	it("renders as a text input with a numeric input mode", () => {
		render(<BlindLevelInput />);

		const input = screen.getByRole("textbox");
		expect(input).toHaveAttribute("type", "text");
		expect(input).toHaveAttribute("inputmode", "numeric");
	});

	it("paints the focus highlight as an inset ring so the bottom row is not clipped by the table's overflow wrapper (SA2-70)", () => {
		// The shared Table wraps the <table> in an `overflow-x-auto` div, which
		// the CSS spec coerces to `overflow-y: auto`. An outset focus ring on the
		// bottom-most cell would overflow that wrapper and be clipped; an inset
		// ring is painted inside the cell and survives the clip.
		render(<BlindLevelInput />);

		const input = screen.getByRole("textbox");
		expect(input).toHaveClass(
			"focus:bg-accent",
			"focus:ring-1",
			"focus:ring-inset",
			"focus:ring-ring"
		);
	});

	it("merges a caller-supplied className with the base classes", () => {
		render(<BlindLevelInput className="text-left" />);

		const input = screen.getByRole("textbox");
		expect(input).toHaveClass("text-left", "h-8", "w-full", "focus:ring-inset");
	});

	it("forwards arbitrary input props such as defaultValue and onBlur", () => {
		const onBlur = vi.fn();
		render(<BlindLevelInput defaultValue="100" onBlur={onBlur} />);

		const input = screen.getByRole<HTMLInputElement>("textbox");
		expect(input.value).toBe("100");

		fireEvent.blur(input);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});
});
