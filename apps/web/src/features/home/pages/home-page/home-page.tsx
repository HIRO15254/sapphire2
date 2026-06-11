import { Link } from "@tanstack/react-router";
import { PageSection } from "@/shared/components/page-section";
import { PublicPageShell } from "@/shared/components/public-page-shell";
import { Button } from "@/shared/components/ui/button";
import { useHomePage } from "./use-home-page";

export function HomePage() {
	const { isConnected, isSignedIn, userName, statusText, statusDescription } =
		useHomePage();

	return (
		<PublicPageShell
			actions={
				<>
					<Button asChild>
						<Link to={isSignedIn ? "/dashboard" : "/login"}>
							{isSignedIn ? "Open Dashboard" : "Get Started"}
						</Link>
					</Button>
					{isSignedIn ? null : (
						<Button asChild variant="outline">
							<Link to="/login">Sign In</Link>
						</Button>
					)}
				</>
			}
			aside={
				<PageSection
					description="The same shared UI system now powers public entry, auth, and the authenticated app."
					heading="What you can do"
				>
					<ul className="space-y-2 text-muted-foreground text-sm">
						<li>Track live and historical sessions in one place.</li>
						<li>Manage rooms, currencies, players, and shared tags.</li>
						<li>Jump straight into live session tools after sign in.</li>
					</ul>
				</PageSection>
			}
			description="A lightweight public entry point for session tracking, room management, and live play workflows."
			eyebrow="Session Tracking"
			title="sapphire2 keeps your poker operations in sync."
		>
			<div className="space-y-4">
				<PageSection
					description="Public routes stay lightweight while still reflecting the current app health."
					heading="API Status"
				>
					<div className="flex items-center gap-3">
						<div
							className={`size-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
						/>
						<div className="space-y-1">
							<p className="font-medium">API: {statusText}</p>
							<p className="text-muted-foreground text-sm">
								{statusDescription}
							</p>
						</div>
					</div>
				</PageSection>
				<PageSection
					description={
						isSignedIn
							? `Signed in as ${userName ?? "your account"}. Continue where you left off.`
							: "Sign in to access dashboard, settings, sessions, and live tools."
					}
					heading={isSignedIn ? "Ready to continue" : "Start with your account"}
				>
					<div className="flex flex-wrap gap-3">
						<Button asChild variant={isSignedIn ? "default" : "outline"}>
							<Link to={isSignedIn ? "/dashboard" : "/login"}>
								{isSignedIn ? "Go to Dashboard" : "Open Sign In"}
							</Link>
						</Button>
					</div>
				</PageSection>
			</div>
		</PublicPageShell>
	);
}
