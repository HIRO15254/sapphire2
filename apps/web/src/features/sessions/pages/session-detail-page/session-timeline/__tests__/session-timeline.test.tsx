import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	sceneProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@/features/live-sessions/components/session-events-scene", () => ({
	SessionEventsScene: (props: Record<string, unknown>) => {
		mocks.sceneProps = props;
		return <div data-testid="events-scene" />;
	},
}));

import { SessionTimeline } from "@/features/sessions/pages/session-detail-page/session-timeline/session-timeline";

describe("SessionTimeline", () => {
	it("renders the events scene read-only and embedded for the given live session", () => {
		render(<SessionTimeline liveSessionId="s1" sessionType="cash_game" />);
		expect(screen.getByTestId("events-scene")).toBeInTheDocument();
		expect(mocks.sceneProps).toMatchObject({
			embedded: true,
			readOnly: true,
			sessionId: "s1",
			sessionType: "cash_game",
		});
	});

	it("renders a Timeline heading", () => {
		render(<SessionTimeline liveSessionId="s2" sessionType="tournament" />);
		expect(
			screen.getByRole("heading", { name: "Timeline" })
		).toBeInTheDocument();
	});
});
