import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CashGameCompleteForm } from "./cash-game-complete-form";

const SIGNED_VALUE_PATTERN = /^-?[\d+]/;
const CASH_OUT_LABEL_PATTERN = /cash-out amount/i;
const RESULT_LABEL_PATTERN = /^Result \(/;
const EV_RESULT_LABEL_PATTERN = /^EV result \(/;

function getPreviewRowValueElement(labelPattern: string | RegExp): HTMLElement {
	const label = screen.getByText(labelPattern);
	const row = label.closest("div");
	if (!row) {
		throw new Error(`Preview row not found for label "${labelPattern}"`);
	}
	return within(row).getByText(SIGNED_VALUE_PATTERN);
}

describe("CashGameCompleteForm", () => {
	it("labels the amount field 'Cash-out amount'", () => {
		render(<CashGameCompleteForm formId="f" onSubmit={vi.fn()} />);
		expect(screen.getByLabelText(CASH_OUT_LABEL_PATTERN)).toBeInTheDocument();
	});

	it("renders no preview box when previewInput is not provided", () => {
		render(<CashGameCompleteForm formId="f" onSubmit={vi.fn()} />);
		expect(screen.queryByText("Total buy-in")).not.toBeInTheDocument();
	});

	it("renders the preview box with buy-in, withdrawn and result rows", () => {
		render(
			<CashGameCompleteForm
				defaultFinalStack={51_800}
				formId="f"
				onSubmit={vi.fn()}
				previewInput={{
					chipRemoveTotal: 10_000,
					evDiff: -2728,
					totalBuyIn: 50_000,
				}}
			/>
		);
		expect(screen.getByText("Total buy-in")).toBeInTheDocument();
		expect(getPreviewRowValueElement("Total buy-in")).toHaveTextContent(
			"50,000"
		);
		expect(screen.getByText("Total withdrawn")).toBeInTheDocument();
		expect(getPreviewRowValueElement("Total withdrawn")).toHaveTextContent(
			"10,000"
		);
	});

	it("colors the result row as success and shows a leading plus when positive", () => {
		render(
			<CashGameCompleteForm
				defaultFinalStack={51_800}
				formId="f"
				onSubmit={vi.fn()}
				previewInput={{
					chipRemoveTotal: 10_000,
					evDiff: -2728,
					totalBuyIn: 50_000,
				}}
			/>
		);
		const resultLabel = screen.getByText(RESULT_LABEL_PATTERN);
		expect(resultLabel).toHaveTextContent("Result (51,800 + 10,000 − 50,000)");
		const resultValue = getPreviewRowValueElement(RESULT_LABEL_PATTERN);
		expect(resultValue).toHaveTextContent("+11,800");
		expect(resultValue.className).toContain("text-success");
	});

	it("colors the result row as destructive when negative", () => {
		render(
			<CashGameCompleteForm
				defaultFinalStack={5000}
				formId="f"
				onSubmit={vi.fn()}
				previewInput={{
					chipRemoveTotal: 0,
					evDiff: null,
					totalBuyIn: 20_000,
				}}
			/>
		);
		const resultValue = getPreviewRowValueElement(RESULT_LABEL_PATTERN);
		expect(resultValue).toHaveTextContent("-15,000");
		expect(resultValue.className).toContain("text-destructive");
	});

	it("shows the EV result row with a leading plus when evDiff is provided", () => {
		render(
			<CashGameCompleteForm
				defaultFinalStack={51_800}
				formId="f"
				onSubmit={vi.fn()}
				previewInput={{
					chipRemoveTotal: 10_000,
					evDiff: -2728,
					totalBuyIn: 50_000,
				}}
			/>
		);
		const evResultLabel = screen.getByText(EV_RESULT_LABEL_PATTERN);
		expect(evResultLabel).toHaveTextContent(
			"EV result (result + EV delta -2,728)"
		);
		expect(
			getPreviewRowValueElement(EV_RESULT_LABEL_PATTERN)
		).toHaveTextContent("+9,072");
	});

	it("hides the EV result row when evDiff is null", () => {
		render(
			<CashGameCompleteForm
				defaultFinalStack={51_800}
				formId="f"
				onSubmit={vi.fn()}
				previewInput={{
					chipRemoveTotal: 10_000,
					evDiff: null,
					totalBuyIn: 50_000,
				}}
			/>
		);
		expect(screen.queryByText(EV_RESULT_LABEL_PATTERN)).not.toBeInTheDocument();
	});

	it("updates the preview live as the final stack input changes", async () => {
		const user = userEvent.setup();
		render(
			<CashGameCompleteForm
				defaultFinalStack={51_800}
				formId="f"
				onSubmit={vi.fn()}
				previewInput={{
					chipRemoveTotal: 10_000,
					evDiff: -2728,
					totalBuyIn: 50_000,
				}}
			/>
		);
		const input = screen.getByLabelText(CASH_OUT_LABEL_PATTERN);
		await user.clear(input);
		await user.type(input, "5000");
		const resultLabel = screen.getByText(RESULT_LABEL_PATTERN);
		expect(resultLabel).toHaveTextContent("Result (5,000 + 10,000 − 50,000)");
		expect(getPreviewRowValueElement(RESULT_LABEL_PATTERN)).toHaveTextContent(
			"-35,000"
		);
	});

	it("still submits finalStack unchanged when a preview is showing", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		render(
			<>
				<CashGameCompleteForm
					defaultFinalStack={51_800}
					formId="f"
					onSubmit={onSubmit}
					previewInput={{
						chipRemoveTotal: 10_000,
						evDiff: -2728,
						totalBuyIn: 50_000,
					}}
				/>
				<button form="f" type="submit">
					Save
				</button>
			</>
		);
		await user.click(screen.getByRole("button", { name: "Save" }));
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenNthCalledWith(1, { finalStack: 51_800 });
	});
});
