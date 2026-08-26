import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { PauseOverlay } from "@/features/live-sessions/pages/active-session-page/pause-overlay";

function setup(
	overrides: Partial<React.ComponentProps<typeof PauseOverlay>> = {}
) {
	const props: React.ComponentProps<typeof PauseOverlay> = {
		elapsedText: "03:02:15",
		onNote: vi.fn(),
		onResume: vi.fn(),
		...overrides,
	};
	render(<PauseOverlay {...props} />);
	return props;
}

describe("PauseOverlay", () => {
	it("renders the paused headline, elapsed clock and guard hint", () => {
		setup();
		expect(screen.getByText("Session paused")).toBeInTheDocument();
		expect(screen.getByText("03:02:15")).toBeInTheDocument();
		expect(
			screen.getByText("Only notes can be logged while paused.")
		).toBeInTheDocument();
	});

	it("calls onResume exactly once and not onNote", async () => {
		const user = userEvent.setup();
		const props = setup();
		await user.click(screen.getByRole("button", { name: "Resume" }));
		expect(props.onResume).toHaveBeenCalledTimes(1);
		expect(props.onNote).not.toHaveBeenCalled();
	});

	it("calls onNote exactly once and not onResume", async () => {
		const user = userEvent.setup();
		const props = setup();
		await user.click(screen.getByRole("button", { name: "Note" }));
		expect(props.onNote).toHaveBeenCalledTimes(1);
		expect(props.onResume).not.toHaveBeenCalled();
	});
});
