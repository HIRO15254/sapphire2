import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { ActionBar } from "@/features/live-sessions/pages/active-session-page/action-bar";

function setup(
	overrides: Partial<React.ComponentProps<typeof ActionBar>> = {}
) {
	const props: React.ComponentProps<typeof ActionBar> = {
		dimmed: false,
		kind: "cash_game",
		onAllIn: vi.fn(),
		onChips: vi.fn(),
		onNote: vi.fn(),
		onPurchase: vi.fn(),
		onTimeline: vi.fn(),
		...overrides,
	};
	render(<ActionBar {...props} />);
	return props;
}

describe("ActionBar — cash_game layout", () => {
	it("renders exactly the four cash-game labels in order", () => {
		setup({ kind: "cash_game" });
		expect(
			screen.getAllByRole("button").map((button) => button.textContent)
		).toEqual(["Timeline", "Chip adjust", "All-in", "Note"]);
	});

	it("calls onTimeline exactly once when Timeline is clicked", async () => {
		const user = userEvent.setup();
		const props = setup({ kind: "cash_game" });
		await user.click(screen.getByRole("button", { name: "Timeline" }));
		expect(props.onTimeline).toHaveBeenCalledTimes(1);
	});

	it("calls onChips exactly once when Chip adjust is clicked", async () => {
		const user = userEvent.setup();
		const props = setup({ kind: "cash_game" });
		await user.click(screen.getByRole("button", { name: "Chip adjust" }));
		expect(props.onChips).toHaveBeenCalledTimes(1);
	});

	it("calls onAllIn exactly once when All-in is clicked", async () => {
		const user = userEvent.setup();
		const props = setup({ kind: "cash_game" });
		await user.click(screen.getByRole("button", { name: "All-in" }));
		expect(props.onAllIn).toHaveBeenCalledTimes(1);
	});

	it("calls onNote exactly once when Note is clicked", async () => {
		const user = userEvent.setup();
		const props = setup({ kind: "cash_game" });
		await user.click(screen.getByRole("button", { name: "Note" }));
		expect(props.onNote).toHaveBeenCalledTimes(1);
	});
});

describe("ActionBar — tournament layout", () => {
	it("renders exactly the three tournament labels in order", () => {
		setup({ kind: "tournament" });
		expect(
			screen.getAllByRole("button").map((button) => button.textContent)
		).toEqual(["Timeline", "Chip purchase", "Note"]);
	});

	it("calls onPurchase exactly once when Chip purchase is clicked", async () => {
		const user = userEvent.setup();
		const props = setup({ kind: "tournament" });
		await user.click(screen.getByRole("button", { name: "Chip purchase" }));
		expect(props.onPurchase).toHaveBeenCalledTimes(1);
	});

	it("does not render a Chip adjust or All-in button", () => {
		setup({ kind: "tournament" });
		expect(
			screen.queryByRole("button", { name: "Chip adjust" })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "All-in" })
		).not.toBeInTheDocument();
	});
});

describe("ActionBar — dimmed state", () => {
	it("disables Chip adjust and All-in but keeps Timeline and Note enabled for cash_game", () => {
		setup({ kind: "cash_game", dimmed: true });
		expect(screen.getByRole("button", { name: "Timeline" })).toBeEnabled();
		expect(screen.getByRole("button", { name: "Chip adjust" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "All-in" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Note" })).toBeEnabled();
	});

	it("disables Chip purchase but keeps Timeline and Note enabled for tournament", () => {
		setup({ kind: "tournament", dimmed: true });
		expect(screen.getByRole("button", { name: "Timeline" })).toBeEnabled();
		expect(
			screen.getByRole("button", { name: "Chip purchase" })
		).toBeDisabled();
		expect(screen.getByRole("button", { name: "Note" })).toBeEnabled();
	});

	it("keeps every button enabled for cash_game when not dimmed", () => {
		setup({ kind: "cash_game", dimmed: false });
		for (const button of screen.getAllByRole("button")) {
			expect(button).toBeEnabled();
		}
	});

	it("keeps every button enabled for tournament when not dimmed", () => {
		setup({ kind: "tournament", dimmed: false });
		for (const button of screen.getAllByRole("button")) {
			expect(button).toBeEnabled();
		}
	});

	it("does not call onChips when Chip adjust is disabled and clicked", async () => {
		const user = userEvent.setup();
		const props = setup({ kind: "cash_game", dimmed: true });
		await user.click(screen.getByRole("button", { name: "Chip adjust" }));
		expect(props.onChips).not.toHaveBeenCalled();
	});
});
