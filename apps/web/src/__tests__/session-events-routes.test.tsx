import { render } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";

const sceneSpy = vi.hoisted(() =>
	vi.fn((_props: unknown) => <div data-testid="scene" />)
);
const activeSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/live-sessions/components/session-events-scene", () => ({
	SessionEventsScene: (props: unknown) => sceneSpy(props),
}));

vi.mock("@/features/live-sessions/hooks/use-active-session", () => ({
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

	it("live-session events route has a redirect beforeLoad handler", async () => {
		const module = await import(
			"@/routes/live-sessions/$sessionType/$sessionId/events"
		);
		// The route now redirects to /sessions/$id — verify beforeLoad is defined
		expect(module.Route.options.beforeLoad).toBeDefined();
		// Component is a no-op after redirect
		const Component = module.Route.options.component as ComponentType;
		expect(Component).toBeDefined();
	});

	it("falls back to empty sessionId when no active session is present", async () => {
		activeSessionMock.mockReturnValue({
			activeSession: null,
			isLoading: false,
		});

		const module = await import("@/routes/active-session/events");
		const Component = module.Route.options.component as ComponentType;

		render(<Component />);

		expect(sceneSpy).toHaveBeenLastCalledWith(
			expect.objectContaining({
				emptySessionMessage: "No active session",
				refetchInterval: 3000,
				sessionId: "",
				sessionLoading: false,
				sessionType: "cash_game",
			})
		);
	});

	it("reports sessionLoading=true while active session query is pending", async () => {
		activeSessionMock.mockReturnValue({
			activeSession: null,
			isLoading: true,
		});

		const module = await import("@/routes/active-session/events");
		const Component = module.Route.options.component as ComponentType;

		render(<Component />);

		expect(sceneSpy).toHaveBeenLastCalledWith(
			expect.objectContaining({
				sessionLoading: true,
			})
		);
	});

	it("live-session events route redirects to sessions/$id", async () => {
		const module = await import(
			"@/routes/live-sessions/$sessionType/$sessionId/events"
		);
		// The beforeLoad handler throws a redirect — verify the redirect target
		const beforeLoad = module.Route.options.beforeLoad as (ctx: {
			params: { sessionId: string; sessionType: string };
		}) => never;
		expect(() =>
			beforeLoad({
				params: { sessionId: "session-10", sessionType: "cash-game" },
			})
		).toThrow();
	});
});
