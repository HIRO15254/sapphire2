import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { PageSection } from "@/shared/components/page-section";
import { PreviewAutoLogin } from "@/shared/components/preview-auto-login";
import { PublicPageShell } from "@/shared/components/public-page-shell";
import SignInForm from "@/shared/components/sign-in-form";
import SignUpForm from "@/shared/components/sign-up-form";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (session.data) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	const [showSignIn, setShowSignIn] = useState(false);

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
						<li>Keep players, sessions, stores, and settings in one place.</li>
					</ul>
				</PageSection>
			}
			description="Use the same shared auth flow for direct credentials or linked providers."
			eyebrow="Authentication"
			title={showSignIn ? "Welcome back." : "Create your account."}
		>
			<PreviewAutoLogin />
			{showSignIn ? (
				<SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
			) : (
				<SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
			)}
		</PublicPageShell>
	);
}
