import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChipsDirectionField } from "./chips-direction-field";

const ADD_LABEL = "Add chips (+)";
const WITHDRAW_LABEL = "Withdraw (−)";

describe("ChipsDirectionField", () => {
	it("renders both pills with the exact accessible names", () => {
		render(<ChipsDirectionField onChange={vi.fn()} value="add" />);
		expect(screen.getByRole("button", { name: ADD_LABEL })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: WITHDRAW_LABEL })
		).toBeInTheDocument();
	});

	it("marks the Add chips (+) pill as pressed when value is 'add'", () => {
		render(<ChipsDirectionField onChange={vi.fn()} value="add" />);
		expect(screen.getByRole("button", { name: ADD_LABEL })).toHaveAttribute(
			"aria-pressed",
			"true"
		);
		expect(
			screen.getByRole("button", { name: WITHDRAW_LABEL })
		).toHaveAttribute("aria-pressed", "false");
	});

	it("marks the Withdraw (−) pill as pressed when value is 'remove'", () => {
		render(<ChipsDirectionField onChange={vi.fn()} value="remove" />);
		expect(screen.getByRole("button", { name: ADD_LABEL })).toHaveAttribute(
			"aria-pressed",
			"false"
		);
		expect(
			screen.getByRole("button", { name: WITHDRAW_LABEL })
		).toHaveAttribute("aria-pressed", "true");
	});

	it("calls onChange with 'add' exactly once when the Add chips (+) pill is clicked", async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(<ChipsDirectionField onChange={onChange} value="remove" />);
		await user.click(screen.getByRole("button", { name: ADD_LABEL }));
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith("add");
	});

	it("calls onChange with 'remove' exactly once when the Withdraw (−) pill is clicked", async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(<ChipsDirectionField onChange={onChange} value="add" />);
		await user.click(screen.getByRole("button", { name: WITHDRAW_LABEL }));
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith("remove");
	});

	it("renders the Direction label", () => {
		render(<ChipsDirectionField onChange={vi.fn()} value="add" />);
		expect(screen.getByText("Direction")).toBeInTheDocument();
	});
});
