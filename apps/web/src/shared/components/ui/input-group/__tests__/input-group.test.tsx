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
});
