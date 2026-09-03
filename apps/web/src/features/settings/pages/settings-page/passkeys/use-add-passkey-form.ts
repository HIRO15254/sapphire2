import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";
import { authClient } from "@/lib/auth-client";
import { describeCurrentDevice } from "@/shared/lib/device-name";

interface UseAddPasskeyFormOptions {
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
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
	const form = useForm({
		defaultValues: {
			name: describeCurrentDevice(),
		},
		onSubmit: async ({ value }) => {
			const result = await authClient.passkey.addPasskey({
				name: value.name.trim(),
			});

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
