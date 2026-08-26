import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CashGameCompleteForm } from "./cash-game-complete-form";

const SIGNED_VALUE_PATTERN = /^-?[\d+]/;
const FINAL_STACK_LABEL_PATTERN = /final stack/i;

function getPreviewRowValueElement(labelText: string): HTMLElement {
	const label = screen.getByText(labelText);
	const row = label.closest("div");
	if (!row) {
		throw new Error(`Preview row not found for label "${labelText}"`);
	}
	return within(row).getByText(SIGNED_VALUE_PATTERN);
}

describe("CashGameCompleteForm", () => {
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
		const resultValue = getPreviewRowValueElement("Result");
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
		const resultValue = getPreviewRowValueElement("Result");
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
		expect(screen.getByText("EV result")).toBeInTheDocument();
		expect(getPreviewRowValueElement("EV result")).toHaveTextContent("+9,072");
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
		expect(screen.queryByText("EV result")).not.toBeInTheDocument();
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
		const input = screen.getByLabelText(FINAL_STACK_LABEL_PATTERN);
		await user.clear(input);
		await user.type(input, "5000");
		expect(getPreviewRowValueElement("Result")).toHaveTextContent("-35,000");
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
