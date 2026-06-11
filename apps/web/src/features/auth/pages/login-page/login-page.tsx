import { PageSection } from "@/shared/components/page-section";
import { PreviewAutoLogin } from "@/shared/components/preview-auto-login";
import { PublicPageShell } from "@/shared/components/public-page-shell";
import SignInForm from "@/shared/components/sign-in-form";
import SignUpForm from "@/shared/components/sign-up-form";
import { useLoginPage } from "./use-login-page";

export function LoginPage() {
	const { showSignIn, onSwitchToSignIn, onSwitchToSignUp } = useLoginPage();

	return (
		<PublicPageShell
			aside={
				<PageSection
					description="Choose the auth method that fits your setup and land directly in the app."
					heading="Why sign in here"
				>
					<ul className="space-y-2 text-muted-foreground text-sm">
						<li>Resume your dashboard and current live-session flow.</li>
						<li>
							Use email/password or connected Google and Discord accounts.
						</li>
						<li>Keep players, sessions, rooms, and settings in one place.</li>
					</ul>
				</PageSection>
			}
			description="Use the same shared auth flow for direct credentials or linked providers."
			eyebrow="Authentication"
			title={showSignIn ? "Welcome back." : "Create your account."}
		>
			<PreviewAutoLogin />
			{showSignIn ? (
				<SignInForm onSwitchToSignUp={onSwitchToSignUp} />
			) : (
				<SignUpForm onSwitchToSignIn={onSwitchToSignIn} />
			)}
		</PublicPageShell>
	);
}
