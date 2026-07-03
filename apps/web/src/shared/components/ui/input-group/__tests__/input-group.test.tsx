import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InputGroup } from "@/shared/components/ui/input-group";

describe("InputGroup", () => {
	it("renders the label heading", () => {
		render(
			<InputGroup label="Rules">
				<input aria-label="blind" />
			</InputGroup>
		);
		expect(screen.getByText("Rules")).toBeInTheDocument();
	});

	it("renders its children inside the group", () => {
		render(
			<InputGroup label="Result">
				<input aria-label="buy-in" />
			</InputGroup>
		);
		expect(screen.getByLabelText("buy-in")).toBeInTheDocument();
	});

	it("forwards a custom className onto the section", () => {
		const { container } = render(
			<InputGroup className="custom-section" label="Master">
				<span>child</span>
			</InputGroup>
		);
		const section = container.querySelector("section");
		expect(section).toHaveClass("custom-section");
	});
});
