import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";
import {
	pendingAuthorizeUrl,
	socialCallbackUrl,
} from "@/features/auth/utils/login-continuation";
import { authClient } from "@/lib/auth-client";

export function useSignUp() {
	const navigate = useNavigate({ from: "/" });
	const { isPending } = authClient.useSession();

	const form = useForm({
		defaultValues: {
			email: "",
			name: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signUp.email(
				{
					email: value.email,
					password: value.password,
					name: value.name,
				},
				{
					onSuccess: () => {
						const authorizeUrl = pendingAuthorizeUrl();
						if (authorizeUrl) {
							window.location.assign(authorizeUrl);
							return;
						}
						navigate({ to: "/statistics" });
						toast.success("Sign up successful");
					},
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText);
					},
				}
			);
		},
		validators: {
			onSubmit: z.object({
				name: z.string().min(2, "Name must be at least 2 characters"),
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	const onSignInWithGoogle = async () => {
		const result = await authClient.signIn.social({
			provider: "google",
			callbackURL: socialCallbackUrl(),
		});
		if (result.error) {
			toast.error(result.error.message || "Google sign up unavailable");
		}
	};

	const onSignInWithDiscord = async () => {
		const result = await authClient.signIn.social({
			provider: "discord",
			callbackURL: socialCallbackUrl(),
		});
		if (result.error) {
			toast.error(result.error.message || "Discord sign up unavailable");
		}
	};

	return { form, isPending, onSignInWithDiscord, onSignInWithGoogle };
}
