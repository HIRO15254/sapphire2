import { useForm, useStore } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import z from "zod";
import { offerAutomaticPasskey } from "@/features/auth/utils/auto-register-passkey";
import {
	pendingAuthorizeUrl,
	socialCallbackUrl,
} from "@/features/auth/utils/login-continuation";
import { authClient } from "@/lib/auth-client";

const EMAIL_IN_USE_MESSAGE = "This email is already in use";
const RETRY_MESSAGE = "Try again.";

export function useSignUp() {
	const navigate = useNavigate({ from: "/" });
	const { isPending } = authClient.useSession();
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [emailInUse, setEmailInUse] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			email: "",
			name: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			setErrorMessage(null);
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
						navigate({ to: "/" });
						offerAutomaticPasskey();
					},
					onError: (error) => {
						if (error.error.code?.startsWith("USER_ALREADY_EXISTS")) {
							setEmailInUse(value.email);
							return;
						}
						setErrorMessage(
							error.error.message || error.error.statusText || RETRY_MESSAGE
						);
					},
				}
			);
		},
		validators: {
			onSubmit: z.object({
				name: z.string().trim().min(2, "Use at least 2 characters"),
				email: z.email("Enter a valid email address"),
				password: z.string().min(8, "Use at least 8 characters"),
			}),
		},
	});
	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

	const signUpWithProvider = async (provider: "discord" | "google") => {
		setErrorMessage(null);
		const result = await authClient.signIn.social({
			provider,
			callbackURL: socialCallbackUrl(),
		});
		if (result.error) {
			setErrorMessage(result.error.message || RETRY_MESSAGE);
		}
	};

	return {
		emailError: (email: string) =>
			email === emailInUse ? EMAIL_IN_USE_MESSAGE : undefined,
		errorMessage,
		form,
		isBusy: isSubmitting,
		isPending,
		isSubmitting,
		onSignUpWithDiscord: () => signUpWithProvider("discord"),
		onSignUpWithGoogle: () => signUpWithProvider("google"),
	};
}
