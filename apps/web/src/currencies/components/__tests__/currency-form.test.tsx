import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CurrencyForm } from "../currency-form";

describe("CurrencyForm", () => {
	it("submits create values without changing the payload shape", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(<CurrencyForm onSubmit={onSubmit} />);

		await user.type(screen.getByLabelText("Currency Name *"), "Yen");
		await user.type(screen.getByLabelText("Unit"), "JPY");
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).toHaveBeenCalledWith({
			name: "Yen",
			unit: "JPY",
		});
	});

	it("submits edited values without changing the payload shape", () => {
		const onSubmit = vi.fn();

		render(
			<CurrencyForm
				defaultValues={{ name: "Dollar", unit: "$" }}
				onSubmit={onSubmit}
			/>
		);

		fireEvent.change(screen.getByLabelText("Currency Name *"), {
			target: { value: "USD" },
		});
		fireEvent.change(screen.getByLabelText("Unit"), {
			target: { value: "US$" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).toHaveBeenCalledWith({
			name: "USD",
			unit: "US$",
		});
	});

	it("calls onCancel when cancel is pressed", async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();

		render(<CurrencyForm onCancel={onCancel} onSubmit={vi.fn()} />);

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onCancel).toHaveBeenCalledOnce();
	});
});
