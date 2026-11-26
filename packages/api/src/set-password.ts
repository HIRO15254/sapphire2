import z from "zod";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const SET_PASSWORD_MESSAGES = {
	internal: "Something went wrong. Try again.",
	malformedBody: "Send the new password as a JSON object.",
	missingPassword: "Enter a new password",
	passwordAlreadySet: "This account already has a password.",
	rejectedTooLong: "This password is too long.",
	rejectedTooShort: "This password is too short.",
	tooLong: `Use ${PASSWORD_MAX_LENGTH} characters or fewer`,
	tooShort: `Use at least ${PASSWORD_MIN_LENGTH} characters`,
	unauthorized: "Your session has expired. Sign in again.",
} as const;

export const newPasswordSchema = z
	.string({ error: SET_PASSWORD_MESSAGES.missingPassword })
	.min(PASSWORD_MIN_LENGTH, SET_PASSWORD_MESSAGES.tooShort)
	.max(PASSWORD_MAX_LENGTH, SET_PASSWORD_MESSAGES.tooLong);

export const setPasswordInputSchema = z.object(
	{ newPassword: newPasswordSchema },
	{ error: SET_PASSWORD_MESSAGES.malformedBody }
);

export type SetPasswordInput = z.infer<typeof setPasswordInputSchema>;

export const setPasswordSuccessSchema = z.object({ status: z.literal(true) });

export type SetPasswordSuccess = z.infer<typeof setPasswordSuccessSchema>;

export const setPasswordErrorSchema = z.discriminatedUnion("code", [
	z.object({
		code: z.literal("INVALID_INPUT"),
		field: z.literal("newPassword").nullable(),
		message: z.string(),
	}),
	z.object({
		code: z.enum(["UNAUTHORIZED", "PASSWORD_ALREADY_SET", "INTERNAL"]),
		message: z.string(),
	}),
]);

export type SetPasswordError = z.infer<typeof setPasswordErrorSchema>;

export type SetPasswordErrorCode = SetPasswordError["code"];
