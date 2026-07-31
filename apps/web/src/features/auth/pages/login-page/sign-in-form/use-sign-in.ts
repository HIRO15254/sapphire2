import { env } from "@sapphire2/env/web";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";
import { resolveMcpAuthorizeRedirect } from "@/features/auth/utils/oauth-redirect";
import { authClient } from "@/lib/auth-client";

export function useSignIn() {
	const navigate = useNavigate({ from: "/" });
	const { isPending } = authClient.useSession();

	/** Where an in-flight MCP OAuth authorize flow should resume, if any. */
	const pendingAuthorizeUrl = () =>
		resolveMcpAuthorizeRedirect(env.VITE_SERVER_URL, window.location.search);

	/**
	 * Social sign-in returns to /login (query preserved) mid-OAuth so the
	 * route's beforeLoad can resume the authorize flow; otherwise straight to
	 * the app.
	 */
	const socialCallbackUrl = () =>
		pendingAuthorizeUrl()
			? `${window.location.origin}/login${window.location.search}`
			: `${window.location.origin}/statistics`;

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

	return { form, isPending, onSignInWithDiscord, onSignInWithGoogle };
}
