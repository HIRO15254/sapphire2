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
		confirmPassword: z.string(),
		newPassword: z.string().min(8, "Use at least 8 characters"),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "The passwords don't match",
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
				toast.error("Couldn't set the password", {
					description: (error as { message?: string }).message,
				});
				return;
			}

			toast.success("Password set", {
				description: "You can now sign in with your email.",
			});
			onSuccess();
			onOpenChange(false);
		},
		validators: {
			onSubmit: setPasswordSchema,
		},
	});

	return { form };
}
