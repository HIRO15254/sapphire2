import { useSignUp } from "@/shared/hooks/use-sign-up";
import { AuthFormShell, authSubmitLabels } from "./auth-form-shell";
import { DiscordIcon } from "./icons/discord";
import { GoogleIcon } from "./icons/google";
import Loader from "./loader";
import { Button } from "./ui/button";
import { Field } from "./ui/field";
import { Input } from "./ui/input";

export default function SignUpForm({
	onSwitchToSignIn,
}: {
	onSwitchToSignIn: () => void;
}) {
	const { form, isPending, onSignInWithDiscord, onSignInWithGoogle } =
		useSignUp();

	if (isPending) {
		return <Loader />;
	}

	const providerActions = [
		{
			label: "Sign up with Google",
			icon: <GoogleIcon className="mr-2 h-4 w-4" />,
			onClick: onSignInWithGoogle,
		},
		{
			label: "Sign up with Discord",
			icon: <DiscordIcon className="mr-2 h-4 w-4" />,
			onClick: onSignInWithDiscord,
		},
	];

	return (
		<AuthFormShell
			description="Create your account to start tracking sessions, players, and stores."
			eyebrow="New Account"
			onSwitchMode={onSwitchToSignIn}
			providerActions={providerActions}
			switchLabel="Already have an account? Sign In"
			title="Create your sapphire2 account"
		>
			<form
				className="space-y-4"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="name">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Name"
						>
							<Input
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>

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
								? authSubmitLabels.signUp.submitting
								: authSubmitLabels.signUp.idle}
						</Button>
					)}
				</form.Subscribe>
			</form>
		</AuthFormShell>
	);
}
