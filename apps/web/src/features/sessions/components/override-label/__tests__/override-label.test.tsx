import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OverrideLabel } from "../override-label";

describe("OverrideLabel", () => {
	it.each([
		{ overridden: undefined, scenario: "no override set is given" },
		{
			overridden: new Set(["BB"]),
			scenario: "the label is absent from the set",
		},
		{ overridden: new Set(), scenario: "the set is empty" },
	])("renders the bare label when $scenario", ({ overridden }) => {
		render(<OverrideLabel label="SB" overridden={overridden} />);
		expect(screen.getByText("SB")).toBeInTheDocument();
		expect(screen.queryByText("Modified")).not.toBeInTheDocument();
	});

	it("renders the label with a Modified badge when the label is in the set", () => {
		render(<OverrideLabel label="SB" overridden={new Set(["SB", "BB"])} />);
		expect(screen.getByText("SB")).toBeInTheDocument();
		expect(screen.getByText("Modified")).toBeInTheDocument();
	});
});
