import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TYPES = [
	{ id: "t1", name: "Deposit" },
	{ id: "t2", name: "Withdrawal" },
];

const hoisted = vi.hoisted(() => ({
	useTransactionTypes: vi.fn(),
}));

vi.mock("@/features/currencies/hooks/use-transaction-types", () => ({
	useTransactionTypes: hoisted.useTransactionTypes,
}));

import { TransactionFormV2 } from "@/features/currencies/v2/components/transaction-form";

describe("TransactionFormV2", () => {
	beforeEach(() => {
		hoisted.useTransactionTypes.mockReturnValue({
			types: TYPES,
			createType: vi.fn(),
			isCreatingType: false,
		});
	});

	it("renders all four fields with their labels", () => {
		render(<TransactionFormV2 formId="x" onSubmit={vi.fn()} />);
		expect(screen.getByText("Type")).toBeInTheDocument();
		expect(screen.getByText("Amount")).toBeInTheDocument();
		expect(screen.getByText("Date")).toBeInTheDocument();
		expect(screen.getByText("Memo")).toBeInTheDocument();
	});

	it("assigns the supplied formId to the <form> element so an external Save button can submit it", () => {
		const { container } = render(
			<TransactionFormV2 formId="add-tx-form" onSubmit={vi.fn()} />
		);
		const form = container.querySelector("form");
		expect(form).not.toBeNull();
		expect(form).toHaveAttribute("id", "add-tx-form");
	});

	it("renders the Amount input with inputMode=numeric (never type=number)", () => {
		render(<TransactionFormV2 formId="x" onSubmit={vi.fn()} />);
		// The amount label points at the same id as the amount input.
		const amount = screen.getByLabelText("Amount *");
		expect(amount).toHaveAttribute("inputmode", "numeric");
		expect(amount).not.toHaveAttribute("type", "number");
	});

	it("renders the Date field as a native date picker (HTML type='date')", () => {
		const { container } = render(
			<TransactionFormV2 formId="x" onSubmit={vi.fn()} />
		);
		const date = container.querySelector('input[type="date"]');
		expect(date).not.toBeNull();
	});

	it("marks Type / Amount / Date as required (red asterisk) and Memo as optional", () => {
		render(<TransactionFormV2 formId="x" onSubmit={vi.fn()} />);
		const asterisks = screen.getAllByText("*");
		// Type, Amount, Date — three required fields.
		expect(asterisks).toHaveLength(3);
		// Memo label has no sibling asterisk.
		const memoLabel = screen.getByText("Memo");
		expect(memoLabel.parentElement?.textContent).toBe("Memo");
	});

	it("renders the negative-amount hint as the Amount description (not a placeholder)", () => {
		render(<TransactionFormV2 formId="x" onSubmit={vi.fn()} />);
		expect(
			screen.getByText("Use a negative value for a withdrawal.")
		).toBeInTheDocument();
	});

	it("seeds the form from defaultValues when provided", () => {
		render(
			<TransactionFormV2
				defaultValues={{
					amount: 1500,
					transactionTypeId: "t1",
					transactedAt: "2026-04-01T00:00:00Z",
					memo: "seed memo",
				}}
				formId="x"
				onSubmit={vi.fn()}
			/>
		);
		expect(screen.getByLabelText("Amount *")).toHaveValue("1500");
		// Type combobox shows the type name resolved from the id.
		expect(screen.getByRole("combobox")).toHaveValue("Deposit");
		expect(screen.getByLabelText("Memo")).toHaveValue("seed memo");
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
