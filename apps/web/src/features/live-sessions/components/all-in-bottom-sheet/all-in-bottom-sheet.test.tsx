import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AllInBottomSheet } from "./all-in-bottom-sheet";

const POT_SIZE_LABEL_PATTERN = /^pot\b/i;
const TRIALS_LABEL_PATTERN = /^runs\b/i;
const EQUITY_LABEL_PATTERN = /equity %/i;
const WINS_LABEL_PATTERN = /wins/i;
const SIGNED_VALUE_PATTERN = /^[+-]/;
const EXPECTED_ROW_LABEL_PATTERN = /^Expected \(/;
const REALIZED_ROW_LABEL_PATTERN = /^Realized \(/;

function getPreviewRowValueElement(labelText: string): HTMLElement {
	const label = screen.getByText(labelText);
	const row = label.closest("div");
	if (!row) {
		throw new Error(`Preview row not found for label "${labelText}"`);
	}
	return within(row).getByText(SIGNED_VALUE_PATTERN);
}

vi.mock("@/shared/components/form-sheet", () => ({
	FormSheet: ({
		children,
		formId,
		open,
		title,
	}: {
		children: ReactNode;
		formId: string;
		open: boolean;
		title: string;
	}) =>
		open ? (
			<div>
				<h2>{title}</h2>
				{children}
				<button aria-label="Save" form={formId} type="submit">
					Save
				</button>
			</div>
		) : null,
}));

describe("AllInBottomSheet", () => {
	it("submits create-mode values via the sheet Save button", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(
			<AllInBottomSheet onOpenChange={vi.fn()} onSubmit={onSubmit} open />
		);

		expect(
			screen.getByRole("heading", { name: "Add All-in" })
		).toBeInTheDocument();
		await user.clear(screen.getByLabelText(POT_SIZE_LABEL_PATTERN));
		await user.type(screen.getByLabelText(POT_SIZE_LABEL_PATTERN), "1200");
		await user.clear(screen.getByLabelText(TRIALS_LABEL_PATTERN));
		await user.type(screen.getByLabelText(TRIALS_LABEL_PATTERN), "2");
		await user.clear(screen.getByLabelText(EQUITY_LABEL_PATTERN));
		await user.type(screen.getByLabelText(EQUITY_LABEL_PATTERN), "25");
		await user.clear(screen.getByLabelText(WINS_LABEL_PATTERN));
		await user.type(screen.getByLabelText(WINS_LABEL_PATTERN), "0.5");
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith({
			equity: 25,
			potSize: 1200,
			trials: 2,
			wins: 0.5,
		});
	});

	it("shows edit-mode title and delete action and calls onDelete", async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		render(
			<AllInBottomSheet
				initialValues={{ equity: 40, potSize: 900, trials: 3, wins: 1 }}
				onDelete={onDelete}
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
			/>
		);

		expect(screen.getByText("Edit All-in")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
		expect(screen.getByDisplayValue("900")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Delete this event" }));
		expect(onDelete).toHaveBeenCalledTimes(1);
	});

	it("renders no delete action when onDelete is not provided", () => {
		render(<AllInBottomSheet onOpenChange={vi.fn()} onSubmit={vi.fn()} open />);
		expect(
			screen.queryByRole("button", { name: "Delete this event" })
		).not.toBeInTheDocument();
	});

	it("resets fields to initial values when opened", () => {
		render(
			<AllInBottomSheet
				initialValues={{ equity: 40, potSize: 900, trials: 3, wins: 1 }}
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
			/>
		);
		expect(screen.getByLabelText(POT_SIZE_LABEL_PATTERN)).toHaveValue("900");
		expect(screen.getByLabelText(TRIALS_LABEL_PATTERN)).toHaveValue("3");
		expect(screen.getByLabelText(EQUITY_LABEL_PATTERN)).toHaveValue("40");
		expect(screen.getByLabelText(WINS_LABEL_PATTERN)).toHaveValue("1");
	});

	it("shows the live preview box with expected, realized and EV delta rows", () => {
		render(
			<AllInBottomSheet
				initialValues={{ equity: 50, potSize: 1000, trials: 2, wins: 1 }}
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
			/>
		);
		expect(screen.getByText("Expected (1,000 × 50%)")).toBeInTheDocument();
		expect(screen.getByText("+500")).toBeInTheDocument();
		expect(
			screen.getByText("Realized (1,000 ÷ 2 × 1 win)")
		).toBeInTheDocument();
		expect(screen.getByText("-500")).toBeInTheDocument();
		expect(screen.getByText("EV delta")).toBeInTheDocument();
		expect(screen.getByText("+0")).toBeInTheDocument();
	});

	it("pluralizes 'win' in the realized row label when wins is not 1", () => {
		render(
			<AllInBottomSheet
				initialValues={{ equity: 50, potSize: 1000, trials: 4, wins: 2 }}
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
			/>
		);
		const realizedLabel = screen.getByText(REALIZED_ROW_LABEL_PATTERN);
		expect(realizedLabel).toHaveTextContent("Realized (1,000 ÷ 4 × 2 wins)");
	});

	it("renders the delete action as an outlined destructive button with a trash icon", async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		render(
			<AllInBottomSheet
				initialValues={{ equity: 40, potSize: 900, trials: 3, wins: 1 }}
				onDelete={onDelete}
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
			/>
		);
		const deleteButton = screen.getByRole("button", {
			name: "Delete this event",
		});
		expect(deleteButton.className).toContain("border-destructive");
		expect(deleteButton.className).toContain("text-destructive");
		expect(deleteButton.querySelector("svg")).not.toBeNull();
		await user.click(deleteButton);
		expect(onDelete).toHaveBeenCalledTimes(1);
	});

	it("updates the preview box as the pot size field changes", async () => {
		const user = userEvent.setup();
		render(
			<AllInBottomSheet
				initialValues={{ equity: 50, potSize: 1000, trials: 1, wins: 0 }}
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
			/>
		);
		await user.clear(screen.getByLabelText(POT_SIZE_LABEL_PATTERN));
		await user.type(screen.getByLabelText(POT_SIZE_LABEL_PATTERN), "2000");
		expect(
			getPreviewRowValueElement("Expected (2,000 × 50%)")
		).toHaveTextContent("+1,000");
	});

	it("hides the preview box while equity is out of the valid range", async () => {
		const user = userEvent.setup();
		render(
			<AllInBottomSheet
				initialValues={{ equity: 50, potSize: 1000, trials: 2, wins: 1 }}
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
			/>
		);
		await user.clear(screen.getByLabelText(EQUITY_LABEL_PATTERN));
		await user.type(screen.getByLabelText(EQUITY_LABEL_PATTERN), "150");
		expect(
			screen.queryByText(EXPECTED_ROW_LABEL_PATTERN)
		).not.toBeInTheDocument();
		expect(screen.queryByText("EV delta")).not.toBeInTheDocument();
	});

	it("colors the EV delta value as destructive when negative", () => {
		render(
			<AllInBottomSheet
				initialValues={{ equity: 78, potSize: 12_400, trials: 1, wins: 1 }}
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
			/>
		);
		const evDeltaValue = getPreviewRowValueElement("EV delta");
		expect(evDeltaValue).toHaveTextContent("-2,728");
		expect(evDeltaValue.className).toContain("text-destructive");
	});

	it("colors the EV delta value as success when positive", () => {
		render(
			<AllInBottomSheet
				initialValues={{ equity: 78, potSize: 12_400, trials: 1, wins: 0 }}
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
			/>
		);
		const evDeltaValue = getPreviewRowValueElement("EV delta");
		expect(evDeltaValue).toHaveTextContent("+9,672");
		expect(evDeltaValue.className).toContain("text-success");
	});
});
