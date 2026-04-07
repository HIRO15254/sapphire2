import { render } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";

const sceneSpy = vi.hoisted(() =>
	vi.fn((_props: unknown) => <div data-testid="scene" />)
);
const activeSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/live-sessions/components/session-events-scene", () => ({
	SessionEventsScene: (props: unknown) => sceneSpy(props),
}));

vi.mock("@/live-sessions/hooks/use-active-session", () => ({
	useActiveSession: () => activeSessionMock(),
}));

describe("session event route wrappers", () => {
	it("passes active session state into the active-session wrapper", async () => {
		activeSessionMock.mockReturnValue({
			activeSession: { id: "active-1", type: "cash_game" },
			isLoading: false,
		});

		const module = await import("@/routes/active-session/events");
		const Component = module.Route.options.component as ComponentType;

		render(<Component />);

		expect(sceneSpy).toHaveBeenLastCalledWith(
			expect.objectContaining({
				emptySessionMessage: "No active session",
				refetchInterval: 3000,
				sessionId: "active-1",
				sessionLoading: false,
				sessionType: "cash_game",
			})
		);
	});

	it("passes route params into the live-session wrapper", async () => {
		const module = await import(
			"@/routes/live-sessions/$sessionType/$sessionId/events"
		);
		vi.spyOn(module.Route, "useParams").mockReturnValue({
			sessionId: "session-9",
			sessionType: "tournament",
		} as never);
		const Component = module.Route.options.component as ComponentType;

		render(<Component />);

		expect(sceneSpy).toHaveBeenLastCalledWith(
			expect.objectContaining({
				sessionId: "session-9",
				sessionType: "tournament",
			})
		);
	});
});
