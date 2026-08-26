import { IconCards } from "@tabler/icons-react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { SessionHeader } from "@/features/live-sessions/pages/active-session-page/session-header";

const TITLE_PATTERN = /Cash Game/;

function setup(
	overrides: Partial<React.ComponentProps<typeof SessionHeader>> = {}
) {
	const props: React.ComponentProps<typeof SessionHeader> = {
		isPaused: false,
		menuItems: [],
		onEnd: vi.fn(),
		onTogglePause: vi.fn(),
		startedAt: null,
		title: "Cash Game",
		...overrides,
	};
	render(<SessionHeader {...props} />);
	return props;
}

describe("SessionHeader", () => {
	it("renders the title", () => {
		setup();
		expect(screen.getByText("Cash Game")).toBeInTheDocument();
	});

	it("shows the paused pill when paused and no recording indicator", () => {
		setup({ isPaused: true });
		expect(screen.getByText("Paused")).toBeInTheDocument();
		expect(screen.queryByTestId("recording-dot")).not.toBeInTheDocument();
	});

	it("shows the recording indicator when active", () => {
		setup({ isPaused: false });
		expect(screen.getByTestId("recording-dot")).toBeInTheDocument();
		expect(screen.queryByText("Paused")).not.toBeInTheDocument();
	});

	it("labels the toggle Pause while active and calls onTogglePause once", async () => {
		const user = userEvent.setup();
		const props = setup({ isPaused: false });
		await user.click(screen.getByRole("button", { name: "Pause session" }));
		expect(props.onTogglePause).toHaveBeenCalledTimes(1);
	});

	it("labels the toggle Resume while paused", async () => {
		const user = userEvent.setup();
		const props = setup({ isPaused: true });
		await user.click(screen.getByRole("button", { name: "Resume session" }));
		expect(props.onTogglePause).toHaveBeenCalledTimes(1);
	});

	it("calls onEnd exactly once from the end button", async () => {
		const user = userEvent.setup();
		const props = setup();
		await user.click(screen.getByRole("button", { name: "End session" }));
		expect(props.onEnd).toHaveBeenCalledTimes(1);
		expect(props.onTogglePause).not.toHaveBeenCalled();
	});

	it("renders the title as plain text without onTitleTap", () => {
		setup();
		expect(
			screen.queryByRole("button", { name: TITLE_PATTERN })
		).not.toBeInTheDocument();
	});

	it("invokes onTitleTap when the title button is tapped", async () => {
		const user = userEvent.setup();
		const onTitleTap = vi.fn();
		setup({ onTitleTap });
		await user.click(screen.getByRole("button", { name: TITLE_PATTERN }));
		expect(onTitleTap).toHaveBeenCalledTimes(1);
	});

	it("renders no overflow button when there are no menu items", () => {
		setup({ menuItems: [] });
		expect(
			screen.queryByRole("button", { name: "Session actions" })
		).not.toBeInTheDocument();
	});

	it("opens the overflow menu and fires the tapped item once", async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		setup({
			menuItems: [{ icon: IconCards, label: "Game settings", onSelect }],
		});
		await user.click(screen.getByRole("button", { name: "Session actions" }));
		await user.click(screen.getByRole("button", { name: "Game settings" }));
		expect(onSelect).toHaveBeenCalledTimes(1);
	});
});
