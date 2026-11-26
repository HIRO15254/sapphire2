import {
	SET_PASSWORD_MESSAGES,
	type SetPasswordError,
	type SetPasswordInput,
	type SetPasswordSuccess,
	setPasswordInputSchema,
} from "@sapphire2/api/set-password";
import { isAPIError } from "better-auth/api";

export interface SetPasswordFailure {
	body: SetPasswordError;
	status: 400 | 401 | 409 | 500;
}

export type SetPasswordRequest =
	| { data: SetPasswordInput; success: true }
	| { failure: SetPasswordFailure; success: false };

export const SET_PASSWORD_SUCCESS: SetPasswordSuccess = { status: true };

function invalidInput(
	message: string,
	field: "newPassword" | null
): SetPasswordFailure {
	return { body: { code: "INVALID_INPUT", field, message }, status: 400 };
}

export const SET_PASSWORD_INTERNAL_FAILURE: SetPasswordFailure = {
	body: { code: "INTERNAL", message: SET_PASSWORD_MESSAGES.internal },
	status: 500,
};

export function parseSetPasswordRequest(text: string): SetPasswordRequest {
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		return {
			failure: invalidInput(SET_PASSWORD_MESSAGES.malformedBody, null),
			success: false,
		};
	}
	const parsed = setPasswordInputSchema.safeParse(json);
	if (parsed.success) {
		return { data: parsed.data, success: true };
	}
	const [issue] = parsed.error.issues;
	const field = issue?.path[0] === "newPassword" ? "newPassword" : null;
	return {
		failure: invalidInput(
			issue?.message ?? SET_PASSWORD_MESSAGES.malformedBody,
			field
		),
		success: false,
	};
}

export function setPasswordFailureFrom(error: unknown): SetPasswordFailure {
	if (!isAPIError(error)) {
		return SET_PASSWORD_INTERNAL_FAILURE;
	}
	switch (error.body?.code) {
		case "PASSWORD_ALREADY_SET":
			return {
				body: {
					code: "PASSWORD_ALREADY_SET",
					message: SET_PASSWORD_MESSAGES.passwordAlreadySet,
				},
				status: 409,
			};
		case "PASSWORD_TOO_SHORT":
			return invalidInput(
				SET_PASSWORD_MESSAGES.rejectedTooShort,
				"newPassword"
			);
		case "PASSWORD_TOO_LONG":
			return invalidInput(SET_PASSWORD_MESSAGES.rejectedTooLong, "newPassword");
		default:
			break;
	}
	if (error.statusCode === 401) {
		return {
			body: {
				code: "UNAUTHORIZED",
				message: SET_PASSWORD_MESSAGES.unauthorized,
			},
			status: 401,
		};
	}
	return SET_PASSWORD_INTERNAL_FAILURE;
}
