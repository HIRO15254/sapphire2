import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { AuthFormShell, authSubmitLabels } from "./auth-form-shell";
import { DiscordIcon } from "./icons/discord";
import { GoogleIcon } from "./icons/google";
import Loader from "./loader";
import { Button } from "./ui/button";
import { Field } from "./ui/field";
import { Input } from "./ui/input";

export default function SignInForm({
	onSwitchToSignUp,
}: {
	onSwitchToSignUp: () => void;
}) {
	const navigate = useNavigate({
		from: "/",
	});
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
						navigate({
							to: "/dashboard",
						});
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

	if (isPending) {
		return <Loader />;
	}

	const providerActions = [
		{
			label: "Sign in with Google",
			icon: <GoogleIcon className="mr-2 h-4 w-4" />,
			onClick: async () => {
				const result = await authClient.signIn.social({
					provider: "google",
					callbackURL: `${window.location.origin}/dashboard`,
				});
				if (result.error) {
					toast.error(result.error.message || "Google sign in unavailable");
				}
			},
		},
		{
			label: "Sign in with Discord",
			icon: <DiscordIcon className="mr-2 h-4 w-4" />,
			onClick: async () => {
				const result = await authClient.signIn.social({
					provider: "discord",
					callbackURL: `${window.location.origin}/dashboard`,
				});
				if (result.error) {
					toast.error(result.error.message || "Discord sign in unavailable");
				}
			},
		},
	];

	return (
		<AuthFormShell
			description="Use your email and password or continue with a linked provider."
			eyebrow="Welcome Back"
			footerNote="You will be redirected to the dashboard after signing in."
			onSwitchMode={onSwitchToSignUp}
			providerActions={providerActions}
			switchLabel="Need an account? Sign Up"
			title="Sign in to sapphire2"
		>
			<form
				className="space-y-4"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="email">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Email"
						>
							<Input
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								type="email"
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>

				<form.Field name="password">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Password"
						>
							<Input
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								type="password"
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>

				<form.Subscribe>
					{(state) => (
						<Button
							className="w-full"
							disabled={!state.canSubmit || state.isSubmitting}
							type="submit"
						>
							{state.isSubmitting
								? authSubmitLabels.signIn.submitting
								: authSubmitLabels.signIn.idle}
						</Button>
					)}
				</form.Subscribe>
			</form>
		</AuthFormShell>
	);
}
