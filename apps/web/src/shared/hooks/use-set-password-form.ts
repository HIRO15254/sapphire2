import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";
import { authClient } from "@/lib/auth-client";

interface UseSetPasswordFormOptions {
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}

const setPasswordSchema = z
	.object({
		confirmPassword: z
			.string()
			.min(8, "Password must be at least 8 characters"),
		newPassword: z.string().min(8, "Password must be at least 8 characters"),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

export function useSetPasswordForm({
	onOpenChange,
	onSuccess,
}: UseSetPasswordFormOptions) {
	const form = useForm({
		defaultValues: {
			confirmPassword: "",
			newPassword: "",
		},
		onSubmit: async ({ value }) => {
			const { error } = await authClient.$fetch("/set-password", {
				method: "POST",
				body: { newPassword: value.newPassword },
			});

			if (error) {
				toast.error(
					(error as { message?: string }).message ?? "Failed to set password"
				);
				return;
			}

			toast.success("Password set successfully");
			onSuccess();
			onOpenChange(false);
		},
		validators: {
			onSubmit: setPasswordSchema,
		},
	});

	return { form };
}
