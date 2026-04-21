import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";

describe("liveCashGameSession router", () => {
	it("appRouter has liveCashGameSession namespace", () => {
		expect(appRouter.liveCashGameSession).toBeDefined();
	});

	it("has list procedure", () => {
		expect(appRouter.liveCashGameSession.list).toBeDefined();
	});

	it("has getById procedure", () => {
		expect(appRouter.liveCashGameSession.getById).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.liveCashGameSession.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.liveCashGameSession.update).toBeDefined();
	});

	it("has discard procedure", () => {
		expect(appRouter.liveCashGameSession.discard).toBeDefined();
	});

	it("update accepts ringGameId input", () => {
		const inputSchema =
			appRouter.liveCashGameSession.update._def.inputs[0] ??
			appRouter.liveCashGameSession.update._def.inputs;
		const shape =
			(inputSchema as { shape?: Record<string, unknown> })?.shape ??
			(
				inputSchema as {
					_def?: { shape?: () => Record<string, unknown> };
				}
			)?._def?.shape?.();
		expect(shape).toBeDefined();
		expect(shape?.ringGameId).toBeDefined();
	});
});
