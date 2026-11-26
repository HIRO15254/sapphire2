import {
	newPasswordSchema,
	SET_PASSWORD_MESSAGES,
	type SetPasswordInput,
	setPasswordErrorSchema,
} from "@sapphire2/api/set-password";
import { useForm, useStore } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { authClient } from "@/lib/auth-client";

interface UseSetPasswordFormOptions {
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}

type SetPasswordOutcome =
	| { kind: "success" }
	| { kind: "field-error"; message: string }
	| { kind: "failure"; message: string };

const FAILURE_TITLE = "Couldn't set the password";
export const SET_PASSWORD_NETWORK_MESSAGE =
	"Couldn't reach the server. Check your connection and try again.";

const setPasswordFormSchema = z
	.object({
		confirmPassword: z.string(),
		newPassword: newPasswordSchema,
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "The passwords don't match",
		path: ["confirmPassword"],
	});

async function requestSetPassword(
	input: SetPasswordInput
): Promise<SetPasswordOutcome> {
	let error: unknown;
	try {
		({ error } = await authClient.$fetch("/set-password", {
			body: input,
			method: "POST",
		}));
	} catch {
		return { kind: "failure", message: SET_PASSWORD_NETWORK_MESSAGE };
	}
	if (!error) {
		return { kind: "success" };
	}
	const parsed = setPasswordErrorSchema.safeParse(error);
	if (!parsed.success) {
		return { kind: "failure", message: SET_PASSWORD_MESSAGES.internal };
	}
	if (parsed.data.code === "INVALID_INPUT" && parsed.data.field !== null) {
		return { kind: "field-error", message: parsed.data.message };
	}
	return { kind: "failure", message: parsed.data.message };
}

export function useSetPasswordForm({
	onOpenChange,
	onSuccess,
}: UseSetPasswordFormOptions) {
	const [rejectedPassword, setRejectedPassword] = useState<{
		message: string;
		value: string;
	} | null>(null);

	const form = useForm({
		defaultValues: {
			confirmPassword: "",
			newPassword: "",
		},
		onSubmit: async ({ value }) => {
			setRejectedPassword(null);
			const outcome = await requestSetPassword({
				newPassword: value.newPassword,
			});
			if (outcome.kind === "field-error") {
				setRejectedPassword({
					message: outcome.message,
					value: value.newPassword,
				});
				return;
			}
			if (outcome.kind === "failure") {
				toast.error(FAILURE_TITLE, { description: outcome.message });
				return;
			}
			toast.success("Password set", {
				description: "You can now sign in with your email.",
			});
			form.reset();
			onSuccess();
			onOpenChange(false);
		},
		validators: {
			onSubmit: setPasswordFormSchema,
		},
	});
	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

	const onSheetOpenChange = (open: boolean) => {
		if (!open) {
			form.reset();
			setRejectedPassword(null);
		}
		onOpenChange(open);
	};
	const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();
		if (form.state.isSubmitting) {
			return;
		}
		form.handleSubmit();
	};
	const onFieldChange =
		(field: { handleChange: (value: string) => void }) =>
		(event: React.ChangeEvent<HTMLInputElement>) =>
			field.handleChange(event.target.value);
	const newPasswordServerError = (value: string) =>
		rejectedPassword?.value === value ? rejectedPassword.message : undefined;

	return {
		form,
		isSubmitting,
		newPasswordServerError,
		onFieldChange,
		onSheetOpenChange,
		onSubmit,
	};
}
