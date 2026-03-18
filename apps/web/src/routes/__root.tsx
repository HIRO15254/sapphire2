import type { QueryClient } from "@tanstack/react-query";

import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import { DevtoolsToggle } from "@/components/devtools-toggle";
import { MobileNav } from "@/components/mobile-nav";
import { SidebarNav } from "@/components/sidebar-nav";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { authClient } from "@/lib/auth-client";
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

function RootComponent() {
	return (
		<>
			<HeadContent />
			<ThemeProvider
				attribute="class"
				defaultTheme="dark"
				disableTransitionOnChange
				storageKey="vite-ui-theme"
			>
				<SidebarNav />
				<div className="flex h-svh flex-col md:ml-56">
					<div className="flex-1 overflow-auto pb-16 md:pb-0">
						<Outlet />
					</div>
				</div>
				<MobileNav />
				<Toaster position="top-right" richColors />
			</ThemeProvider>
			<DevtoolsToggle />
		</>
	);
}
