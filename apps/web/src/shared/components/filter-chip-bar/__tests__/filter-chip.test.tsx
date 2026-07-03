import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FilterChip } from "@/shared/components/filter-chip-bar/filter-chip";

const WHITESPACE = /\s+/;

/** The class tokens the chip itself toggles, as discrete tokens (not substrings
 * — the base Button variant carries `aria-invalid:border-destructive`, which a
 * naive `toContain` would false-match). */
function classTokens(): string[] {
	return screen.getByRole("button").className.split(WHITESPACE);
}

describe("FilterChip", () => {
	it("renders the label and value", () => {
		render(<FilterChip label="Type" onClick={vi.fn()} value="Cash" />);
		expect(screen.getByText("Type:")).toBeInTheDocument();
		expect(screen.getByText("Cash")).toBeInTheDocument();
	});

	it("fires onClick when pressed", async () => {
		const onClick = vi.fn();
		const user = userEvent.setup();
		render(<FilterChip label="Type" onClick={onClick} value="Cash" />);
		await user.click(screen.getByRole("button"));
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("applies the active (primary) treatment when active", () => {
		render(<FilterChip active label="Room" onClick={vi.fn()} value="Aria" />);
		const tokens = classTokens();
		expect(tokens).toContain("border-primary/60");
		expect(tokens).toContain("bg-primary/10");
		expect(tokens).toContain("text-primary");
	});

	it("applies the invalid (destructive) treatment when invalid", () => {
		render(
			<FilterChip invalid label="Currency" onClick={vi.fn()} value="Select" />
		);
		const tokens = classTokens();
		expect(tokens).toContain("border-destructive");
		expect(tokens).toContain("text-destructive");
	});

	it("prefers the invalid treatment over active when both are set", () => {
		render(
			<FilterChip
				active
				invalid
				label="Currency"
				onClick={vi.fn()}
				value="Select"
			/>
		);
		const tokens = classTokens();
		expect(tokens).toContain("border-destructive");
		expect(tokens).not.toContain("border-primary/60");
	});

	it("uses the resting (neither) treatment by default", () => {
		render(<FilterChip label="Type" onClick={vi.fn()} value="All" />);
		const tokens = classTokens();
		expect(tokens).not.toContain("border-primary/60");
		expect(tokens).not.toContain("border-destructive");
	});
});
