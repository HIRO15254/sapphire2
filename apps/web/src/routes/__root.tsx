import type { QueryClient } from "@tanstack/react-query";

import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	redirect,
	useLocation,
} from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { AuthenticatedShell } from "@/shared/components/authenticated-shell";
import { ReleaseNotesGate } from "@/shared/components/release-notes-gate";
import { ThemeProvider } from "@/shared/components/theme-provider";
import { Toaster } from "@/shared/components/ui/sonner";
import type { trpc } from "@/utils/trpc";

import "../index.css";

export interface RouterAppContext {
	queryClient: QueryClient;
	trpc: typeof trpc;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	beforeLoad: async ({ location }) => {
		if (location.pathname === "/login") {
			return;
		}
		const session = await authClient.getSession();
		if (!session.data) {
			throw redirect({ to: "/login" });
		}
	},
	component: RootComponent,
	head: () => ({
		meta: [
			{
				title: "sapphire2",
			},
			{
				name: "description",
				content: "sapphire2 is a web application",
			},
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.ico",
			},
		],
	}),
});

export function RootComponent() {
	const { pathname } = useLocation();
	const isLoginPage = pathname === "/login";

	return (
		<>
			<HeadContent />
			<ThemeProvider
				attribute="class"
				defaultTheme="dark"
				disableTransitionOnChange
				storageKey="vite-ui-theme"
			>
				{isLoginPage ? (
					<Outlet />
				) : (
					<AuthenticatedShell>
						<div>
							<Outlet />
							<ReleaseNotesGate />
						</div>
					</AuthenticatedShell>
				)}
				<Toaster position="top-right" richColors />
			</ThemeProvider>
		</>
	);
}
