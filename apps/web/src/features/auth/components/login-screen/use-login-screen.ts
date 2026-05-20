import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { authClient } from "@/lib/auth-client";

export type LoginMode = "signin" | "signup";

export type LoginScreenViewProps = Omit<
	ReturnType<typeof useLoginScreen>,
	"isPending"
>;

const credentialsSchema = z.object({
	email: z.email("Invalid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

const DASHBOARD_TARGET = { to: "/dashboard" } as const;

export function useLoginScreen() {
	const navigate = useNavigate({ from: "/" });
	const { isPending } = authClient.useSession();
	const [mode, setMode] = useState<LoginMode>("signin");

	const form = useForm({
		defaultValues: { email: "", password: "" },
		onSubmit: async ({ value }) => {
			if (mode === "signin") {
				await authClient.signIn.email(
					{ email: value.email, password: value.password },
					{
						onSuccess: () => {
							navigate(DASHBOARD_TARGET);
							toast.success("Sign in successful");
						},
						onError: (error) => {
							toast.error(error.error.message || error.error.statusText);
						},
					}
				);
				return;
			}
			const name = value.email.split("@")[0] || value.email;
			await authClient.signUp.email(
				{ email: value.email, password: value.password, name },
				{
					onSuccess: () => {
						navigate(DASHBOARD_TARGET);
						toast.success("Sign up successful");
					},
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText);
					},
				}
			);
		},
		validators: { onSubmit: credentialsSchema },
	});

	const onSignInWithGoogle = async () => {
		const result = await authClient.signIn.social({
			provider: "google",
			callbackURL: `${window.location.origin}/dashboard`,
		});
		if (result.error) {
			toast.error(result.error.message || "Google sign in unavailable");
		}
	};

	const onSignInWithDiscord = async () => {
		const result = await authClient.signIn.social({
			provider: "discord",
			callbackURL: `${window.location.origin}/dashboard`,
		});
		if (result.error) {
			toast.error(result.error.message || "Discord sign in unavailable");
		}
	};

	return {
		form,
		isPending,
		mode,
		onSignInWithDiscord,
		onSignInWithGoogle,
		onSwitchToSignIn: () => setMode("signin"),
		onSwitchToSignUp: () => setMode("signup"),
	};
}
