import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { authClient } from "@/lib/auth-client";
import { describeCurrentDevice } from "@/shared/lib/device-name";
import { setAutomaticPasskeyOptOut } from "@/shared/lib/passkey-opt-out";
import { isCancelledCeremony } from "@/shared/lib/webauthn";

interface UseAddPasskeyFormOptions {
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}

const CANCELED_MESSAGE = "The request was canceled or timed out. Try again.";
const PREVIOUSLY_REGISTERED_CODE = "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED";

function isPreviouslyRegistered(error?: unknown): boolean {
	const candidate = error as
		| { code?: unknown; name?: unknown }
		| null
		| undefined;
	return [candidate?.code, candidate?.name].some(
		(value) =>
			value === PREVIOUSLY_REGISTERED_CODE || value === "InvalidStateError"
	);
}

const addPasskeySchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Enter a name")
		.max(50, "Use 50 characters or fewer"),
});

function describeAddFailure(error?: { message?: string } | null): string {
	if (isCancelledCeremony(error)) {
		return CANCELED_MESSAGE;
	}
	if (isPreviouslyRegistered(error)) {
		return "This device already has a passkey.";
	}
	return error?.message || "Try again.";
}

export function useAddPasskeyForm({
	onOpenChange,
	onSuccess,
}: UseAddPasskeyFormOptions) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			name: describeCurrentDevice(),
		},
		onSubmit: async ({ value }) => {
			if (isSubmitting) {
				return;
			}

			setIsSubmitting(true);
			setErrorMessage(null);
			try {
				const result = await authClient.passkey.addPasskey({
					name: value.name.trim(),
				});

				if (!result?.data || result.error) {
					setErrorMessage(describeAddFailure(result?.error));
					return;
				}

				toast.success("Passkey added");
				setAutomaticPasskeyOptOut(false);
				onSuccess();
				onOpenChange(false);
				form.reset();
			} finally {
				setIsSubmitting(false);
			}
		},
		validators: {
			onSubmit: addPasskeySchema,
		},
	});

	const onSheetOpenChange = (open: boolean) => {
		if (!open) {
			form.reset();
			setErrorMessage(null);
		}
		onOpenChange(open);
	};

	return { errorMessage, form, isSubmitting, onSheetOpenChange };
}
