import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterDateRange } from "@/shared/components/filter-chip-bar/filter-date-range";

describe("FilterDateRange", () => {
	it("renders labeled From/To date inputs bound to the given values", () => {
		render(
			<FilterDateRange
				from="2026-04-01"
				onFromChange={vi.fn()}
				onToChange={vi.fn()}
				to="2026-04-30"
			/>
		);
		const from = screen.getByLabelText("From") as HTMLInputElement;
		const to = screen.getByLabelText("To") as HTMLInputElement;
		expect(from.type).toBe("date");
		expect(from.value).toBe("2026-04-01");
		expect(to.type).toBe("date");
		expect(to.value).toBe("2026-04-30");
	});

	it("fires onFromChange with the new value", () => {
		const onFromChange = vi.fn();
		render(
			<FilterDateRange
				from=""
				onFromChange={onFromChange}
				onToChange={vi.fn()}
				to=""
			/>
		);
		fireEvent.change(screen.getByLabelText("From"), {
			target: { value: "2026-05-05" },
		});
		expect(onFromChange).toHaveBeenCalledTimes(1);
		expect(onFromChange).toHaveBeenCalledWith("2026-05-05");
	});

	it("fires onToChange with the new value", () => {
		const onToChange = vi.fn();
		render(
			<FilterDateRange
				from=""
				onFromChange={vi.fn()}
				onToChange={onToChange}
				to=""
			/>
		);
		fireEvent.change(screen.getByLabelText("To"), {
			target: { value: "2026-05-09" },
		});
		expect(onToChange).toHaveBeenCalledTimes(1);
		expect(onToChange).toHaveBeenCalledWith("2026-05-09");
	});
});
