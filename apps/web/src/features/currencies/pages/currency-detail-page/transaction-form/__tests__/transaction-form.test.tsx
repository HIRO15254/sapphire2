import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TYPES = [
	{ id: "t1", name: "Deposit" },
	{ id: "t2", name: "Withdrawal" },
];

const REQUIRED_ASTERISK_SUFFIX = /\s*\*$/;

const SEEDED = {
	amount: 1500,
	transactionTypeId: "t1",
	transactedAt: "2026-04-01T00:00:00Z",
	memo: "seed memo",
};

const hoisted = vi.hoisted(() => ({
	useTransactionTypes: vi.fn(),
}));

vi.mock("@/features/currencies/hooks/use-transaction-types", () => ({
	useTransactionTypes: hoisted.useTransactionTypes,
}));

import { TransactionFormV2 } from "@/features/currencies/pages/currency-detail-page/transaction-form";

function renderForm(
	props: Partial<React.ComponentProps<typeof TransactionFormV2>> = {}
) {
	const onSubmit = props.onSubmit ?? vi.fn();
	const view = render(
		<>
			<TransactionFormV2 formId="tx-form" onSubmit={onSubmit} {...props} />
			<button form="tx-form" type="submit">
				submit-trigger
			</button>
		</>
	);
	return { ...view, onSubmit };
}

describe("TransactionFormV2", () => {
	beforeEach(() => {
		hoisted.useTransactionTypes.mockReturnValue({
			types: TYPES,
			createType: vi.fn(),
			isCreatingType: false,
		});
	});

	it("renders the Date, Type, Memo, Amount fields in that order", () => {
		const { container } = renderForm();
		const labels = [...container.querySelectorAll("label")].map((label) =>
			label.textContent?.replace(REQUIRED_ASTERISK_SUFFIX, "")
		);
		expect(labels).toEqual(["Date", "Type", "Memo", "Amount"]);
	});

	it.each<[string, Record<string, string>]>([
		["Date *", { type: "date" }],
		["Amount *", { inputmode: "numeric" }],
		["Memo", {}],
	])("renders %s as a native single-line input", (label, attributes) => {
		renderForm();
		const input = screen.getByLabelText(label);
		expect(input.tagName).toBe("INPUT");
		expect(input).not.toHaveAttribute("type", "number");
		for (const [name, value] of Object.entries(attributes)) {
			expect(input).toHaveAttribute(name, value);
		}
	});

	it("assigns the supplied formId to the form element", () => {
		renderForm();
		expect(document.getElementById("tx-form")?.tagName).toBe("FORM");
	});

	it("marks Date, Type, and Amount as required and Memo as optional", () => {
		renderForm();
		expect(screen.getAllByText("*")).toHaveLength(3);
		expect(screen.getByText("Memo").parentElement?.textContent).toBe("Memo");
	});

	it("seeds the inputs from defaultValues", () => {
		renderForm({ defaultValues: SEEDED });
		expect(screen.getByLabelText("Amount *")).toHaveValue("1500");
		expect(screen.getByLabelText("Date *")).toHaveValue("2026-04-01");
		expect(screen.getByRole("combobox")).toHaveValue("Deposit");
		expect(screen.getByLabelText("Memo")).toHaveValue("seed memo");
	});

	it("shows the field errors after a blocked empty submit", async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderForm();
		await user.click(screen.getByRole("button", { name: "submit-trigger" }));
		expect(await screen.findByText("Type is required")).toBeInTheDocument();
		expect(screen.getByText("Required")).toBeInTheDocument();
		expect(screen.getByLabelText("Amount *")).toHaveAttribute(
			"aria-invalid",
			"true"
		);
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits the seeded values to onSubmit once through the form element", async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderForm({ defaultValues: SEEDED });
		await user.click(screen.getByRole("button", { name: "submit-trigger" }));
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
	});
});
