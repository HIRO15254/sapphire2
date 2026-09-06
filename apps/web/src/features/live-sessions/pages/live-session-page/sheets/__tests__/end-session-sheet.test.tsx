import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EndSessionSheet } from "@/features/live-sessions/pages/live-session-page/sheets/end-session-sheet";

const CASH_OUT_LABEL = /Cash-out amount/;

function setup() {
	render(
		<EndSessionSheet
			chipRemoveTotal={300}
			evDiff={500}
			isPending={false}
			onOpenChange={vi.fn()}
			onSubmit={vi.fn()}
			open
			totalBuyIn={10_000}
		/>
	);
	return userEvent.setup();
}

function rowValue(label: string): string {
	const row = screen.getByText(label, { exact: true }).closest("div");
	if (!row) {
		throw new Error(`row for ${label} not found`);
	}
	return within(row).getByRole("definition").textContent ?? "";
}

describe("EndSessionSheet", () => {
	it("shows a dash for Result and EV result while no cash-out is entered", () => {
		setup();
		expect(rowValue("Result")).toBe("—");
		expect(rowValue("EV result")).toBe("—");
	});

	it("follows the entered cash-out amount", async () => {
		const user = setup();
		await user.type(screen.getByLabelText(CASH_OUT_LABEL), "12000");
		expect(rowValue("Result")).toBe("+2,300");
		expect(rowValue("EV result")).toBe("+2,800");
	});

	it("goes back to a dash when the amount is cleared", async () => {
		const user = setup();
		const input = screen.getByLabelText(CASH_OUT_LABEL);
		await user.type(input, "12000");
		await user.clear(input);
		expect(rowValue("Result")).toBe("—");
		expect(rowValue("EV result")).toBe("—");
	});

	it("keeps the fixed buy-in and withdrawal rows independent of the input", async () => {
		const user = setup();
		await user.type(screen.getByLabelText(CASH_OUT_LABEL), "12000");
		expect(rowValue("Total buy-in")).toBe("10,000");
		expect(rowValue("Total withdrawn")).toBe("300");
	});
});
