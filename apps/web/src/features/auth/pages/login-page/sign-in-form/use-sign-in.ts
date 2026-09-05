import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { offerAutomaticPasskey } from "@/features/auth/utils/auto-register-passkey";
import {
	pendingAuthorizeUrl,
	socialCallbackUrl,
} from "@/features/auth/utils/login-continuation";
import { authClient } from "@/lib/auth-client";
import { isCancelledCeremony, isPasskeySupported } from "@/shared/lib/webauthn";

export function useSignIn() {
	const navigate = useNavigate({ from: "/" });
	const { isPending } = authClient.useSession();
	const [isPasskeyPending, setIsPasskeyPending] = useState(false);

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(
				{
					email: value.email,
					password: value.password,
				},
				{
					onSuccess: () => {
						const authorizeUrl = pendingAuthorizeUrl();
						if (authorizeUrl) {
							window.location.assign(authorizeUrl);
							return;
						}
						navigate({ to: "/statistics" });
						toast.success("Sign in successful");
						offerAutomaticPasskey();
					},
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText);
					},
				}
			);
		},
		validators: {
			onSubmit: z.object({
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	const onSignInWithPasskey = async () => {
		if (isPasskeyPending) {
			return;
		}

		setIsPasskeyPending(true);
		try {
			const result = await authClient.signIn.passkey();
			if (!result?.data || result.error) {
				if (!isCancelledCeremony(result?.error)) {
					toast.error(result?.error?.message || "Passkey sign in failed");
				}
				return;
			}
			const authorizeUrl = pendingAuthorizeUrl();
			if (authorizeUrl) {
				window.location.assign(authorizeUrl);
				return;
			}
			navigate({ to: "/statistics" });
			toast.success("Sign in successful");
		} finally {
			setIsPasskeyPending(false);
		}
	};

	const onSignInWithGoogle = async () => {
		const result = await authClient.signIn.social({
			provider: "google",
			callbackURL: socialCallbackUrl(),
		});
		if (result.error) {
			toast.error(result.error.message || "Google sign in unavailable");
		}
	};

	const onSignInWithDiscord = async () => {
		const result = await authClient.signIn.social({
			provider: "discord",
			callbackURL: socialCallbackUrl(),
		});
		if (result.error) {
			toast.error(result.error.message || "Discord sign in unavailable");
		}
	};

	return {
		form,
		isPasskeyPending,
		isPasskeySupported: isPasskeySupported(),
		isPending,
		onSignInWithDiscord,
		onSignInWithGoogle,
		onSignInWithPasskey,
	};
}
