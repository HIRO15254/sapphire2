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
import { isCancelledCeremony, isPasskeySupported } from "@/shared/lib/webauthn";

const WRONG_CREDENTIALS_MESSAGE =
	"Check your email and password, or use another way to sign in.";
const RETRY_MESSAGE = "Try again.";

export function useSignIn() {
	const navigate = useNavigate({ from: "/" });
	const { isPending } = authClient.useSession();
	const [isPasskeyPending, setIsPasskeyPending] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const enterApp = () => {
		const authorizeUrl = pendingAuthorizeUrl();
		if (authorizeUrl) {
			window.location.assign(authorizeUrl);
			return false;
		}
		navigate({ to: "/" });
		return true;
	};

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value, formApi }) => {
			setErrorMessage(null);
			await authClient.signIn.email(
				{
					email: value.email,
					password: value.password,
				},
				{
					onSuccess: () => {
						if (enterApp()) {
							offerAutomaticPasskey();
						}
					},
					onError: (error) => {
						if (error.error.status === 401) {
							formApi.setFieldValue("password", "");
							setErrorMessage(WRONG_CREDENTIALS_MESSAGE);
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
				email: z.email("Enter a valid email address"),
				password: z.string().min(8, "Use at least 8 characters"),
			}),
		},
	});
	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

	const onSignInWithPasskey = async () => {
		if (isPasskeyPending) {
			return;
		}

		setIsPasskeyPending(true);
		setErrorMessage(null);
		try {
			const result = await authClient.signIn.passkey();
			if (!result?.data || result.error) {
				if (!isCancelledCeremony(result?.error)) {
					setErrorMessage(result?.error?.message || RETRY_MESSAGE);
				}
				return;
			}
			enterApp();
		} finally {
			setIsPasskeyPending(false);
		}
	};

	const signInWithProvider = async (provider: "discord" | "google") => {
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
		errorMessage,
		form,
		isBusy: isSubmitting || isPasskeyPending,
		isPasskeyPending,
		isPasskeySupported: isPasskeySupported(),
		isPending,
		isSubmitting,
		onSignInWithDiscord: () => signInWithProvider("discord"),
		onSignInWithGoogle: () => signInWithProvider("google"),
		onSignInWithPasskey,
	};
}
