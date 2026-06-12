import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OverrideLabel } from "../override-label";

describe("OverrideLabel", () => {
	it("renders the bare label when no override set is given", () => {
		render(<OverrideLabel label="SB" />);
		expect(screen.getByText("SB")).toBeInTheDocument();
		expect(screen.queryByText("Modified")).not.toBeInTheDocument();
	});

	it("renders the bare label when the label is absent from the set", () => {
		render(<OverrideLabel label="SB" overridden={new Set(["BB"])} />);
		expect(screen.getByText("SB")).toBeInTheDocument();
		expect(screen.queryByText("Modified")).not.toBeInTheDocument();
	});

	it("renders the label with a Modified badge when the label is in the set", () => {
		render(<OverrideLabel label="SB" overridden={new Set(["SB", "BB"])} />);
		expect(screen.getByText("SB")).toBeInTheDocument();
		expect(screen.getByText("Modified")).toBeInTheDocument();
	});

	it("renders the bare label when the set is empty", () => {
		render(<OverrideLabel label="SB" overridden={new Set()} />);
		expect(screen.getByText("SB")).toBeInTheDocument();
		expect(screen.queryByText("Modified")).not.toBeInTheDocument();
	});
});
