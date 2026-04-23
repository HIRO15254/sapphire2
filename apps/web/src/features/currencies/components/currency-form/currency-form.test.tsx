import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CurrencyForm } from "./currency-form";

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

	it("submits edited values without changing the payload shape", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(
			<CurrencyForm
				defaultValues={{ name: "Dollar", unit: "$" }}
				onSubmit={onSubmit}
			/>
		);

		const nameInput = screen.getByLabelText("Currency Name *");
		await user.clear(nameInput);
		await user.type(nameInput, "USD");
		const unitInput = screen.getByLabelText("Unit");
		await user.clear(unitInput);
		await user.type(unitInput, "US$");
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).toHaveBeenCalledWith({
			name: "USD",
			unit: "US$",
		});
	});

	it("does not submit when required name is empty and surfaces validation error", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(<CurrencyForm onSubmit={onSubmit} />);

		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).not.toHaveBeenCalled();
		expect(screen.getByText("Currency name is required")).toBeInTheDocument();
	});

	it("submits with unit=undefined when the optional unit is left blank", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(<CurrencyForm onSubmit={onSubmit} />);

		await user.type(screen.getByLabelText("Currency Name *"), "Chips");
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).toHaveBeenCalledWith({ name: "Chips", unit: undefined });
	});

	it("shows Saving... and disables submit while isLoading", () => {
		render(<CurrencyForm isLoading onSubmit={vi.fn()} />);
		const button = screen.getByRole("button", { name: "Saving..." });
		expect(button).toBeInTheDocument();
		expect(button).toBeDisabled();
	});
});
