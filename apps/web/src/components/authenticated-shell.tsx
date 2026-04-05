import type { ReactNode } from "react";
import { DevtoolsToggle } from "@/components/devtools-toggle";
import { LiveStackFormSheet } from "@/components/live-sessions/live-stack-form-sheet";
import { MobileNav } from "@/components/mobile-nav";
import { OnlineStatusBar } from "@/components/online-status-bar";
import { SidebarNav } from "@/components/sidebar-nav";
import { SessionFormProvider } from "@/hooks/use-session-form";
import { StackSheetProvider } from "@/hooks/use-stack-sheet";

export function AuthenticatedShell({ children }: { children: ReactNode }) {
	return (
		<SessionFormProvider>
			<StackSheetProvider>
				<div className="min-h-svh bg-background">
					<SidebarNav />
					<div className="flex h-svh flex-col md:ml-56">
						<OnlineStatusBar />
						<div className="flex-1 overflow-auto pb-16 md:pb-0">{children}</div>
					</div>
					<MobileNav />
					<LiveStackFormSheet />
				</div>
			</StackSheetProvider>
			<DevtoolsToggle />
		</SessionFormProvider>
	);
}
