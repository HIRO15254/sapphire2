import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EndSessionSheet } from "@/features/live-sessions/pages/live-session-page/sheets/end-session-sheet";

const CASH_OUT_LABEL = /Cash-out amount/;

function setup(evDiff = 500) {
	render(
		<EndSessionSheet
			chipRemoveTotal={300}
			evDiff={evDiff}
			isPending={false}
			onOpenChange={vi.fn()}
			onSubmit={vi.fn()}
			open
			totalBuyIn={10_000}
		/>
	);
	return userEvent.setup();
}

function row(label: string): HTMLElement {
	const found = screen.getByText(label, { exact: true }).closest("div");
	if (!found) {
		throw new Error(`row for ${label} not found`);
	}
	return found;
}

function rowValue(label: string): string {
	return within(row(label)).getByRole("definition").textContent ?? "";
}

function rowLabel(label: string): string {
	return within(row(label)).getByRole("term").textContent ?? "";
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

	it("explains a row with its formula only once it has a value", async () => {
		const user = setup();
		expect(rowLabel("Result")).toBe("Result");
		expect(rowLabel("EV result")).toBe("EV result");

		await user.type(screen.getByLabelText(CASH_OUT_LABEL), "12000");

		expect(rowLabel("Result")).toBe("Result (12,000 + 300 − 10,000)");
		expect(rowLabel("EV result")).toBe("EV result (result + EV delta +500)");
	});

	it("drops the EV formula when the session recorded no all-in", async () => {
		const user = setup(0);
		await user.type(screen.getByLabelText(CASH_OUT_LABEL), "12000");

		expect(rowValue("EV result")).toBe("—");
		expect(rowLabel("EV result")).toBe("EV result");
	});

	it("keeps the fixed buy-in and withdrawal rows independent of the input", async () => {
		const user = setup();
		await user.type(screen.getByLabelText(CASH_OUT_LABEL), "12000");
		expect(rowValue("Total buy-in")).toBe("10,000");
		expect(rowValue("Total withdrawn")).toBe("300");
	});
});
