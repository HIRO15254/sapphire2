import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";
import { authClient } from "@/lib/auth-client";
import { describeCurrentDevice } from "@/shared/lib/device-name";

interface UseAddPasskeyFormOptions {
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}

// Same bounds as the shared TagNameForm the rename sheet reuses, so the two
// passkey name fields cannot disagree about what is accepted.
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
	const form = useForm({
		defaultValues: {
			// Prefilled, not a placeholder: the user can accept or overwrite it,
			// and either way the passkey ends up with a real name.
			name: describeCurrentDevice(),
		},
		onSubmit: async ({ value }) => {
			// The browser prompt opens inside this call; a user who dismisses it
			// comes back as an error, not a throw.
			const result = await authClient.passkey.addPasskey({
				name: value.name.trim(),
			});

			// A verified registration answers with the stored passkey row, so an
			// empty `data` means the ceremony never completed.
			if (!result?.data || result.error) {
				toast.error(result?.error?.message || "Failed to add passkey");
				return;
			}

			toast.success("Passkey added");
			onSuccess();
			onOpenChange(false);
			form.reset();
		},
		validators: {
			onSubmit: addPasskeySchema,
		},
	});

	return { form };
}
