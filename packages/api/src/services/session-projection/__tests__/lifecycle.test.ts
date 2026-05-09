import { describe, expect, it } from "vitest";
import {
	computeBreakMinutes,
	computeLifecycleFromEvents,
	lifecycleProjection,
} from "../lifecycle";
import { makeChainableDb, makeEvent, makeGameSession } from "./test-utils";

const t = (iso: string) => new Date(iso);

describe("computeLifecycleFromEvents — status derivation", () => {
	it("returns active status and null timestamps for empty events", () => {
		const result = computeLifecycleFromEvents([]);
		expect(result.status).toBe("active");
		expect(result.startedAt).toBeNull();
		expect(result.endedAt).toBeNull();
	});

	it("returns active status after session_start only", () => {
		const result = computeLifecycleFromEvents([
			{
				...makeEvent("session_start", {}),
				occurredAt: t("2024-01-01T10:00:00Z"),
			},
		]);
		expect(result.status).toBe("active");
		expect(result.startedAt).toEqual(t("2024-01-01T10:00:00Z"));
		expect(result.endedAt).toBeNull();
	});

	it("returns paused status when last state event is session_pause", () => {
		const result = computeLifecycleFromEvents([
			{
				...makeEvent("session_start", {}),
				occurredAt: t("2024-01-01T10:00:00Z"),
			},
			{
				...makeEvent("session_pause", {}),
				occurredAt: t("2024-01-01T11:00:00Z"),
			},
		]);
		expect(result.status).toBe("paused");
	});

	it("returns active status after session_resume following session_pause", () => {
		const result = computeLifecycleFromEvents([
			{
				...makeEvent("session_start", {}),
				occurredAt: t("2024-01-01T10:00:00Z"),
			},
			{
				...makeEvent("session_pause", {}),
				occurredAt: t("2024-01-01T11:00:00Z"),
			},
			{
				...makeEvent("session_resume", {}),
				occurredAt: t("2024-01-01T11:30:00Z"),
			},
		]);
		expect(result.status).toBe("active");
	});

	it("returns completed status and sets endedAt after session_end", () => {
		const result = computeLifecycleFromEvents([
			{
				...makeEvent("session_start", {}),
				occurredAt: t("2024-01-01T10:00:00Z"),
			},
			{
				...makeEvent("session_end", {}),
				occurredAt: t("2024-01-01T14:00:00Z"),
			},
		]);
		expect(result.status).toBe("completed");
		expect(result.endedAt).toEqual(t("2024-01-01T14:00:00Z"));
	});

	it("uses first session_start timestamp as startedAt (not subsequent ones)", () => {
		const result = computeLifecycleFromEvents([
			{
				...makeEvent("session_start", {}),
				occurredAt: t("2024-01-01T09:00:00Z"),
			},
			{
				...makeEvent("session_start", {}),
				occurredAt: t("2024-01-01T10:00:00Z"),
			},
		]);
		expect(result.startedAt).toEqual(t("2024-01-01T09:00:00Z"));
	});
});

describe("computeBreakMinutes", () => {
	it("returns 0 for empty events", () => {
		expect(computeBreakMinutes([])).toBe(0);
	});

	it("returns 0 when there is no pause event", () => {
		const events = [
			{
				...makeEvent("session_start", {}),
				occurredAt: t("2024-01-01T10:00:00Z"),
			},
		];
		expect(computeBreakMinutes(events)).toBe(0);
	});

	it("returns 30 minutes for a single pause/resume pair spanning 30 minutes", () => {
		const events = [
			{
				...makeEvent("session_pause", {}),
				occurredAt: t("2024-01-01T11:00:00Z"),
			},
			{
				...makeEvent("session_resume", {}),
				occurredAt: t("2024-01-01T11:30:00Z"),
			},
		];
		expect(computeBreakMinutes(events)).toBe(30);
	});

	it("sums break minutes across multiple pause/resume pairs", () => {
		const events = [
			{
				...makeEvent("session_pause", {}),
				occurredAt: t("2024-01-01T11:00:00Z"),
			},
			{
				...makeEvent("session_resume", {}),
				occurredAt: t("2024-01-01T11:15:00Z"),
			},
			{
				...makeEvent("session_pause", {}),
				occurredAt: t("2024-01-01T12:00:00Z"),
			},
			{
				...makeEvent("session_resume", {}),
				occurredAt: t("2024-01-01T12:45:00Z"),
			},
		];
		expect(computeBreakMinutes(events)).toBe(60);
	});
});

describe("computeLifecycleFromEvents — breakMinutes", () => {
	it("sets breakMinutes to null when there are no pauses", () => {
		const result = computeLifecycleFromEvents([
			{
				...makeEvent("session_start", {}),
				occurredAt: t("2024-01-01T10:00:00Z"),
			},
		]);
		expect(result.breakMinutes).toBeNull();
	});

	it("sets breakMinutes when there are pause/resume pairs", () => {
		const result = computeLifecycleFromEvents([
			{
				...makeEvent("session_pause", {}),
				occurredAt: t("2024-01-01T11:00:00Z"),
			},
			{
				...makeEvent("session_resume", {}),
				occurredAt: t("2024-01-01T11:30:00Z"),
			},
		]);
		expect(result.breakMinutes).toBe(30);
	});
});

describe("lifecycleProjection — DB side effects", () => {
	it("updates game_session status and startedAt when session is found", async () => {
		const events = [
			{
				...makeEvent("session_start", {}),
				occurredAt: t("2024-01-01T10:00:00Z"),
			},
		];
		const session = makeGameSession();
		const db = makeChainableDb([events, [session]]);

		await lifecycleProjection(
			db as unknown as Parameters<typeof lifecycleProjection>[0],
			"session-1"
		);

		expect(db.update).toHaveBeenCalledTimes(1);
		expect(db._updateChain.set).toHaveBeenCalledWith(
			expect.objectContaining({ status: "active" })
		);
	});

	it("returns without updating when session is not found", async () => {
		const events = [
			{
				...makeEvent("session_start", {}),
				occurredAt: t("2024-01-01T10:00:00Z"),
			},
		];
		const db = makeChainableDb([events, []]);

		await lifecycleProjection(
			db as unknown as Parameters<typeof lifecycleProjection>[0],
			"session-1"
		);

		expect(db.update).not.toHaveBeenCalled();
	});

	it("sets endedAt when status is completed", async () => {
		const events = [
			{
				...makeEvent("session_start", {}),
				occurredAt: t("2024-01-01T10:00:00Z"),
			},
			{
				...makeEvent("session_end", {}),
				occurredAt: t("2024-01-01T14:00:00Z"),
			},
		];
		const session = makeGameSession();
		const db = makeChainableDb([events, [session]]);

		await lifecycleProjection(
			db as unknown as Parameters<typeof lifecycleProjection>[0],
			"session-1"
		);

		expect(db._updateChain.set).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "completed",
				endedAt: t("2024-01-01T14:00:00Z"),
			})
		);
	});

	it("sets endedAt to null when status is not completed", async () => {
		const events = [
			{
				...makeEvent("session_start", {}),
				occurredAt: t("2024-01-01T10:00:00Z"),
			},
			{
				...makeEvent("session_pause", {}),
				occurredAt: t("2024-01-01T11:00:00Z"),
			},
		];
		const session = makeGameSession();
		const db = makeChainableDb([events, [session]]);

		await lifecycleProjection(
			db as unknown as Parameters<typeof lifecycleProjection>[0],
			"session-1"
		);

		expect(db._updateChain.set).toHaveBeenCalledWith(
			expect.objectContaining({ status: "paused", endedAt: null })
		);
	});
});
