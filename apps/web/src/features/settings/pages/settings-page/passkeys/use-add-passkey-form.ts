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
		.min(1, "Passkey name is required")
		.max(50, "Passkey name must be 50 characters or less"),
});

export function useAddPasskeyForm({
	onOpenChange,
	onSuccess,
}: UseAddPasskeyFormOptions) {
	const [isSubmitting, setIsSubmitting] = useState(false);

	const form = useForm({
		defaultValues: {
			name: describeCurrentDevice(),
		},
		onSubmit: async ({ value }) => {
			if (isSubmitting) {
				return;
			}

			setIsSubmitting(true);
			try {
				const result = await authClient.passkey.addPasskey({
					name: value.name.trim(),
				});

				if (!result?.data || result.error) {
					if (isCancelledCeremony(result?.error)) {
						return;
					}
					toast.error(
						isPreviouslyRegistered(result?.error)
							? "This device already has a passkey"
							: result?.error?.message || "Failed to add passkey"
					);
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

	return { form, isSubmitting };
}
