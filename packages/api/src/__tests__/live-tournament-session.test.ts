import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";

describe("liveTournamentSession router", () => {
	it("appRouter has liveTournamentSession namespace", () => {
		expect(appRouter.liveTournamentSession).toBeDefined();
	});

	it("has list procedure", () => {
		expect(appRouter.liveTournamentSession.list).toBeDefined();
	});

	it("has getById procedure", () => {
		expect(appRouter.liveTournamentSession.getById).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.liveTournamentSession.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.liveTournamentSession.update).toBeDefined();
	});

	it("has discard procedure", () => {
		expect(appRouter.liveTournamentSession.discard).toBeDefined();
	});

	it("update accepts tournamentId input", () => {
		const inputSchema =
			appRouter.liveTournamentSession.update._def.inputs[0] ??
			appRouter.liveTournamentSession.update._def.inputs;
		const shape =
			(inputSchema as { shape?: Record<string, unknown> })?.shape ??
			(
				inputSchema as {
					_def?: { shape?: () => Record<string, unknown> };
				}
			)?._def?.shape?.();
		expect(shape).toBeDefined();
		expect(shape?.tournamentId).toBeDefined();
	});
});
