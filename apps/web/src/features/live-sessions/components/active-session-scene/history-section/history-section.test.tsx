import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const sceneSpy = vi.hoisted(() =>
	vi.fn((_props: unknown) => <div data-testid="events-scene" />)
);

vi.mock("@/features/live-sessions/components/session-events-scene", () => ({
	SessionEventsScene: (props: unknown) => sceneSpy(props),
}));

import { HistorySection } from "@/features/live-sessions/components/active-session-scene/history-section";

const REGEX_HISTORY = /History/;

function setup() {
	render(<HistorySection sessionId="s-1" sessionType="cash_game" />);
}

describe("HistorySection", () => {
	it("mounts the embedded events scene only while expanded", async () => {
		const user = userEvent.setup();
		setup();
		expect(
			screen.getByRole("button", { name: REGEX_HISTORY })
		).toBeInTheDocument();
		expect(screen.queryByTestId("events-scene")).not.toBeInTheDocument();

		const toggle = screen.getByRole("button", { name: REGEX_HISTORY });
		await user.click(toggle);
		expect(screen.getByTestId("events-scene")).toBeInTheDocument();
		expect(sceneSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				embedded: true,
				refetchInterval: 3000,
				sessionId: "s-1",
				sessionType: "cash_game",
			})
		);

		await user.click(toggle);
		expect(screen.queryByTestId("events-scene")).not.toBeInTheDocument();
	});

	it("exposes the expanded state via aria-expanded", async () => {
		const user = userEvent.setup();
		setup();
		const toggle = screen.getByRole("button", { name: REGEX_HISTORY });
		expect(toggle).toHaveAttribute("aria-expanded", "false");
		await user.click(toggle);
		expect(toggle).toHaveAttribute("aria-expanded", "true");
	});
});
