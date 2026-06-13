import { render } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";

const sceneSpy = vi.hoisted(() =>
	vi.fn((_props: unknown) => <div data-testid="scene" />)
);

vi.mock("@/features/live-sessions/components/session-events-scene", () => ({
	SessionEventsScene: (props: unknown) => sceneSpy(props),
}));

describe("session event route wrappers", () => {
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

	it("coerces unknown sessionType values to cash_game in the live-session route", async () => {
		const module = await import(
			"@/routes/live-sessions/$sessionType/$sessionId/events"
		);
		vi.spyOn(module.Route, "useParams").mockReturnValue({
			sessionId: "session-10",
			sessionType: "garbage-type",
		} as never);
		const Component = module.Route.options.component as ComponentType;

		render(<Component />);

		expect(sceneSpy).toHaveBeenLastCalledWith(
			expect.objectContaining({
				sessionId: "session-10",
				sessionType: "cash_game",
			})
		);
	});
});
