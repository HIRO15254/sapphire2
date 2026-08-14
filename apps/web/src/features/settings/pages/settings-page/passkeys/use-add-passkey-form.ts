import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";
import { authClient } from "@/lib/auth-client";

interface UseAddPasskeyFormOptions {
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}

const addPasskeySchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Required")
		.max(64, "Name must be 64 characters or fewer"),
});

export function useAddPasskeyForm({
	onOpenChange,
	onSuccess,
}: UseAddPasskeyFormOptions) {
	const form = useForm({
		defaultValues: {
			name: "",
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
