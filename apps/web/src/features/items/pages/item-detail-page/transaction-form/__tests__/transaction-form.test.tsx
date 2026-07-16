import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const REQUIRED_ASTERISK_SUFFIX = /\s*\*$/;

import { TransactionFormV2 } from "@/features/items/pages/item-detail-page/transaction-form";

describe("TransactionFormV2 (item)", () => {
	it("renders all three fields with their labels", () => {
		render(<TransactionFormV2 formId="x" onSubmit={vi.fn()} />);
		expect(screen.getByText("Date")).toBeInTheDocument();
		expect(screen.getByText("Count")).toBeInTheDocument();
		expect(screen.getByText("Memo")).toBeInTheDocument();
	});

	it("renders the fields in the order Date, Count, Memo", () => {
		const { container } = render(
			<TransactionFormV2 formId="x" onSubmit={vi.fn()} />
		);
		const labels = [...container.querySelectorAll("label")].map((label) =>
			label.textContent?.replace(REQUIRED_ASTERISK_SUFFIX, "")
		);
		expect(labels).toEqual(["Date", "Count", "Memo"]);
	});

	it("does not render a type field (item transactions have no transaction types)", () => {
		render(<TransactionFormV2 formId="x" onSubmit={vi.fn()} />);
		expect(screen.queryByText("Type")).not.toBeInTheDocument();
		expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
	});

	it("renders Memo as a single-line text input, not a textarea", () => {
		const { container } = render(
			<TransactionFormV2 formId="x" onSubmit={vi.fn()} />
		);
		const memo = screen.getByLabelText("Memo");
		expect(memo.tagName).toBe("INPUT");
		expect(container.querySelector("textarea")).toBeNull();
	});

	it("assigns the supplied formId to the <form> element so an external Save button can submit it", () => {
		const { container } = render(
			<TransactionFormV2 formId="add-item-tx-form" onSubmit={vi.fn()} />
		);
		const form = container.querySelector("form");
		expect(form).not.toBeNull();
		expect(form).toHaveAttribute("id", "add-item-tx-form");
	});

	it("renders the Count input with inputMode=numeric (never type=number)", () => {
		render(<TransactionFormV2 formId="x" onSubmit={vi.fn()} />);
		const count = screen.getByLabelText("Count *");
		expect(count).toHaveAttribute("inputmode", "numeric");
		expect(count).not.toHaveAttribute("type", "number");
	});

	it("renders the Date field as a native date picker (HTML type='date')", () => {
		const { container } = render(
			<TransactionFormV2 formId="x" onSubmit={vi.fn()} />
		);
		const date = container.querySelector('input[type="date"]');
		expect(date).not.toBeNull();
	});

	it("marks Date / Count as required (red asterisk) and Memo as optional", () => {
		render(<TransactionFormV2 formId="x" onSubmit={vi.fn()} />);
		const asterisks = screen.getAllByText("*");
		// Date, Count — two required fields.
		expect(asterisks).toHaveLength(2);
		// Memo label has no sibling asterisk.
		const memoLabel = screen.getByText("Memo");
		expect(memoLabel.parentElement?.textContent).toBe("Memo");
	});

	it("renders the negative-count hint as the Count description (not a placeholder)", () => {
		render(<TransactionFormV2 formId="x" onSubmit={vi.fn()} />);
		expect(
			screen.getByText("Use a negative value when you spend items.")
		).toBeInTheDocument();
	});

	it("does not render any placeholder attributes", () => {
		const { container } = render(
			<TransactionFormV2 formId="x" onSubmit={vi.fn()} />
		);
		expect(container.querySelector("[placeholder]")).toBeNull();
	});

	it("seeds the form from defaultValues when provided", () => {
		render(
			<TransactionFormV2
				defaultValues={{
					count: -3,
					transactedAt: "2026-04-01T00:00:00Z",
					memo: "seed memo",
				}}
				formId="x"
				onSubmit={vi.fn()}
			/>
		);
		expect(screen.getByLabelText("Count *")).toHaveValue("-3");
		expect(screen.getByLabelText("Memo")).toHaveValue("seed memo");
		expect(screen.getByLabelText("Date *")).toHaveValue("2026-04-01");
	});

	it("blocks submission and does not call onSubmit when required fields are empty", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		const { container } = render(
			<TransactionFormV2 formId="x" onSubmit={onSubmit} />
		);
		// Trigger the form's submit event directly — no external Save
		// button in this test.
		const form = container.querySelector("form");
		expect(form).not.toBeNull();
		if (form) {
			await user.click(form);
			form.dispatchEvent(new Event("submit", { cancelable: true }));
		}
		expect(onSubmit).not.toHaveBeenCalled();
	});
});
