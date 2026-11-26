import {
	PASSWORD_MAX_LENGTH,
	setPasswordErrorSchema,
	setPasswordSuccessSchema,
} from "@sapphire2/api/set-password";
import { APIError } from "better-auth/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeEnv } from "./test-utils";

const { setPassword } = vi.hoisted(() => ({ setPassword: vi.fn() }));

vi.mock("@sapphire2/auth", () => ({
	createAuth: () => ({
		api: { setPassword },
		handler: () => new Response("unexpected better-auth handler call"),
	}),
}));

const app = (await import("../worker")).default;
const env = createFakeEnv();

function postSetPassword(body: string) {
	return app.request(
		"/api/auth/set-password",
		{
			body,
			headers: {
				"content-type": "application/json",
				origin: env.CORS_ORIGIN,
			},
			method: "POST",
		},
		env
	);
}

async function readError(response: Response) {
	return setPasswordErrorSchema.parse(await response.json());
}

describe("POST /api/auth/set-password", () => {
	let consoleError: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		setPassword.mockReset();
		setPassword.mockResolvedValue({ status: true });
		consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
	});

	afterEach(() => {
		consoleError.mockRestore();
	});

	it("sets the password with only the validated body and answers the success contract", async () => {
		const response = await postSetPassword(
			JSON.stringify({ newPassword: "correct horse", role: "admin" })
		);

		expect(response.status).toBe(200);
		expect(setPasswordSuccessSchema.parse(await response.json())).toEqual({
			status: true,
		});
		expect(setPassword).toHaveBeenCalledTimes(1);
		expect(setPassword.mock.calls[0]?.[0].body).toEqual({
			newPassword: "correct horse",
		});
	});

	it.each([
		{ body: "{not json", field: null, name: "malformed JSON" },
		{ body: "[]", field: null, name: "a non-object body" },
		{
			body: JSON.stringify({ newPassword: "short" }),
			field: "newPassword",
			name: "a password under the minimum",
		},
		{
			body: JSON.stringify({
				newPassword: "x".repeat(PASSWORD_MAX_LENGTH + 1),
			}),
			field: "newPassword",
			name: "a password over the maximum",
		},
	])(
		"rejects $name as invalid input without calling better-auth",
		async ({ body, field }) => {
			const response = await postSetPassword(body);

			expect(response.status).toBe(400);
			expect(await readError(response)).toMatchObject({
				code: "INVALID_INPUT",
				field,
			});
			expect(setPassword).not.toHaveBeenCalled();
			expect(consoleError).not.toHaveBeenCalled();
		}
	);

	it.each([
		{
			betterAuthCode: "UNAUTHORIZED",
			betterAuthStatus: "UNAUTHORIZED",
			expected: { code: "UNAUTHORIZED" },
			status: 401,
		},
		{
			betterAuthCode: "PASSWORD_ALREADY_SET",
			betterAuthStatus: "BAD_REQUEST",
			expected: { code: "PASSWORD_ALREADY_SET" },
			status: 409,
		},
		{
			betterAuthCode: "PASSWORD_TOO_SHORT",
			betterAuthStatus: "BAD_REQUEST",
			expected: { code: "INVALID_INPUT", field: "newPassword" },
			status: 400,
		},
		{
			betterAuthCode: "PASSWORD_TOO_LONG",
			betterAuthStatus: "BAD_REQUEST",
			expected: { code: "INVALID_INPUT", field: "newPassword" },
			status: 400,
		},
	] as const)(
		"maps better-auth $betterAuthCode to $status without logging it as a server failure",
		async ({ betterAuthCode, betterAuthStatus, expected, status }) => {
			setPassword.mockRejectedValue(
				APIError.from(betterAuthStatus, {
					code: betterAuthCode,
					message: `better-auth ${betterAuthCode}`,
				})
			);

			const response = await postSetPassword(
				JSON.stringify({ newPassword: "correct horse" })
			);

			expect(response.status).toBe(status);
			expect(await readError(response)).toMatchObject(expected);
			expect(consoleError).not.toHaveBeenCalled();
		}
	);

	it.each([
		{
			error: new Error("D1_ERROR: no such table: account secret-hash"),
			name: "an unexpected exception",
		},
		{
			error: APIError.from("INTERNAL_SERVER_ERROR", {
				code: "FAILED_TO_CREATE_USER",
				message: "D1_ERROR: no such table: account secret-hash",
			}),
			name: "an unmapped better-auth error",
		},
	])(
		"answers $name with a generic internal error and logs it",
		async ({ error }) => {
			setPassword.mockRejectedValue(error);

			const response = await postSetPassword(
				JSON.stringify({ newPassword: "correct horse" })
			);
			const text = await response.text();

			expect(response.status).toBe(500);
			expect(setPasswordErrorSchema.parse(JSON.parse(text))).toMatchObject({
				code: "INTERNAL",
			});
			expect(text).not.toContain("D1_ERROR");
			expect(text).not.toContain("secret-hash");
			expect(consoleError).toHaveBeenCalledTimes(1);
		}
	);
});
