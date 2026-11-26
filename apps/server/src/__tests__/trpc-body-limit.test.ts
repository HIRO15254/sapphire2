import { TRPC_MAX_BODY_BYTES } from "@sapphire2/api/lib/request-limits";
import { describe, expect, it } from "vitest";
import app from "../worker";
import { createFakeEnv } from "./test-utils";

const env = createFakeEnv();

describe("/trpc/* body limit", () => {
	it("refuses an oversized body with a tRPC error the client can read, before any procedure runs", async () => {
		const response = await app.request(
			"/trpc/aiExtract.extractTournamentData",
			{
				body: "x".repeat(TRPC_MAX_BODY_BYTES + 1),
				headers: {
					"content-type": "application/json",
					origin: env.CORS_ORIGIN,
				},
				method: "POST",
			},
			env
		);

		expect(response.status).toBe(413);
		expect(response.headers.get("access-control-allow-origin")).toBe(
			env.CORS_ORIGIN
		);
		const body = (await response.json()) as {
			error: { data: { code: string } };
		};
		expect(body.error.data.code).toBe("PAYLOAD_TOO_LARGE");
	});
});
