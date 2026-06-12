import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayerSearch } from "@/features/players/pages/players-page/player-search";

const SEARCH_LABEL = "Search players by name or tag";

describe("PlayerSearch", () => {
	it("renders the search input with the current value", () => {
		render(<PlayerSearch onChange={vi.fn()} value="alice" />);
		expect(screen.getByLabelText(SEARCH_LABEL)).toHaveValue("alice");
	});

	it("calls onChange with the typed character", async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(<PlayerSearch onChange={onChange} value="" />);
		await user.type(screen.getByLabelText(SEARCH_LABEL), "v");
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith("v");
	});

	it("calls onChange with the full next value when editing an existing term", async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(<PlayerSearch onChange={onChange} value="vip" />);
		await user.type(screen.getByLabelText(SEARCH_LABEL), "s");
		expect(onChange).toHaveBeenCalledWith("vips");
	});
});
