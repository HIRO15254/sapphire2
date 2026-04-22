import { AuthFormShell, authSubmitLabels } from "../auth-form-shell";
import { DiscordIcon } from "../icons/discord";
import { GoogleIcon } from "../icons/google";
import Loader from "../loader";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { Input } from "../ui/input";
import { useSignIn } from "./use-sign-in";

export default function SignInForm({
	onSwitchToSignUp,
}: {
	onSwitchToSignUp: () => void;
}) {
	const { form, isPending, onSignInWithDiscord, onSignInWithGoogle } =
		useSignIn();

	if (isPending) {
		return <Loader />;
	}

	const providerActions = [
		{
			label: "Sign in with Google",
			icon: <GoogleIcon className="mr-2 h-4 w-4" />,
			onClick: onSignInWithGoogle,
		},
		{
			label: "Sign in with Discord",
			icon: <DiscordIcon className="mr-2 h-4 w-4" />,
			onClick: onSignInWithDiscord,
		},
	];

	return (
		<AuthFormShell
			description="Use your email and password or continue with a linked provider."
			eyebrow="Welcome Back"
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
