import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";
import { authClient } from "@/lib/auth-client";

interface UseSignInResult {
	form: ReturnType<typeof useForm<{ email: string; password: string }>>;
	isPending: boolean;
	onSignInWithDiscord: () => Promise<void>;
	onSignInWithGoogle: () => Promise<void>;
}

export function useSignIn(): UseSignInResult {
	const navigate = useNavigate({ from: "/" });
	const { isPending } = authClient.useSession();

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
						navigate({ to: "/dashboard" });
						toast.success("Sign in successful");
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

	return { form, isPending, onSignInWithDiscord, onSignInWithGoogle };
}
