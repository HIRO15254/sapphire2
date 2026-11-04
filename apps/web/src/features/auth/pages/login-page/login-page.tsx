import { PreviewAutoLogin } from "@/features/auth/pages/login-page/preview-auto-login";
import SignInForm from "@/features/auth/pages/login-page/sign-in-form";
import SignUpForm from "@/features/auth/pages/login-page/sign-up-form";
import { useLoginPage } from "./use-login-page";

export function LoginPage() {
	const { showSignIn, onSwitchToSignIn, onSwitchToSignUp } = useLoginPage();

	return (
		<div className="min-h-svh bg-background text-foreground">
			<PreviewAutoLogin />
			{showSignIn ? (
				<SignInForm onSwitchToSignUp={onSwitchToSignUp} />
			) : (
				<SignUpForm onSwitchToSignIn={onSwitchToSignIn} />
			)}
		</div>
	);
}
