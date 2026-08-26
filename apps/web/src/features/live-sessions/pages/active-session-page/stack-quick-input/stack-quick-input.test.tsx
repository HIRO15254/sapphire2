import { render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StackQuickInput } from "@/features/live-sessions/pages/active-session-page/stack-quick-input";

const NOW = new Date(2026, 7, 26, 12, 0, 0);
const PLAYERS_LABEL_PATTERN = /players/i;
const STACK_LABEL_PATTERN = /stack/i;
const LAST_UPDATE_PATTERN = /Last update/;

function setup(
	overrides: Partial<React.ComponentProps<typeof StackQuickInput>> = {}
) {
	const props: React.ComponentProps<typeof StackQuickInput> = {
		defaultRemainingPlayers: null,
		defaultTotalEntries: null,
		disabled: false,
		isPending: false,
		kind: "cash_game",
		lastStackUpdatedAt: null,
		onRecordStack: vi.fn(),
		...overrides,
	};
	render(<StackQuickInput {...props} />);
	return props;
}

describe("StackQuickInput — layout by kind", () => {
	it("does not render a players box for cash_game", () => {
		setup({ kind: "cash_game" });
		expect(
			screen.queryByLabelText(PLAYERS_LABEL_PATTERN)
		).not.toBeInTheDocument();
		expect(screen.queryByText("/")).not.toBeInTheDocument();
	});

	it("renders a players box with two inputs for tournament", () => {
		setup({
			kind: "tournament",
			defaultRemainingPlayers: 42,
			defaultTotalEntries: 128,
		});
		expect(screen.getByDisplayValue("42")).toBeInTheDocument();
		expect(screen.getByDisplayValue("128")).toBeInTheDocument();
	});

	it("always renders the Save stack button", () => {
		setup({ kind: "cash_game" });
		expect(
			screen.getByRole("button", { name: "Save stack" })
		).toBeInTheDocument();
	});
});

describe("StackQuickInput — pending and disabled state", () => {
	it("disables the save button while isPending", () => {
		setup({ isPending: true });
		expect(screen.getByRole("button", { name: "Save stack" })).toBeDisabled();
	});

	it("disables the save button while disabled", () => {
		setup({ disabled: true });
		expect(screen.getByRole("button", { name: "Save stack" })).toBeDisabled();
	});

	it("enables the save button when neither disabled nor pending", () => {
		setup({ disabled: false, isPending: false });
		expect(screen.getByRole("button", { name: "Save stack" })).toBeEnabled();
	});

	it("disables the stack amount input while isPending", () => {
		setup({ isPending: true });
		expect(
			screen.getByRole("textbox", { name: STACK_LABEL_PATTERN })
		).toBeDisabled();
	});
});

describe("StackQuickInput — staleness line", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("hides the staleness line when lastStackUpdatedAt is null", () => {
		setup({ lastStackUpdatedAt: null });
		expect(screen.queryByText(LAST_UPDATE_PATTERN)).not.toBeInTheDocument();
	});

	it("shows a muted staleness line for a recent update", () => {
		setup({ lastStackUpdatedAt: new Date(NOW.getTime() - 5 * 60_000) });
		const line = screen.getByText(LAST_UPDATE_PATTERN);
		expect(line).toHaveTextContent("Last update 11:55 · 5m ago");
	});

	it("shows a warning staleness line at 20 minutes", () => {
		setup({ lastStackUpdatedAt: new Date(NOW.getTime() - 20 * 60_000) });
		expect(screen.getByText(LAST_UPDATE_PATTERN)).toHaveTextContent(
			"Last update 11:40 · 20m ago"
		);
	});

	it("shows a destructive staleness line at 45 minutes", () => {
		setup({ lastStackUpdatedAt: new Date(NOW.getTime() - 45 * 60_000) });
		expect(screen.getByText(LAST_UPDATE_PATTERN)).toHaveTextContent(
			"Last update 11:15 · 45m ago"
		);
	});
});
