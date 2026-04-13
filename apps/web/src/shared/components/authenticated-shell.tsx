import type { ReactNode } from "react";
import { LiveStackFormSheet } from "@/live-sessions/components/live-stack-form-sheet";
import { SessionFormProvider } from "@/live-sessions/hooks/use-session-form";
import { StackSheetProvider } from "@/live-sessions/hooks/use-stack-sheet";
import { MobileNav } from "@/shared/components/mobile-nav";
import { OnlineStatusBar } from "@/shared/components/online-status-bar";
import { SidebarNav } from "@/shared/components/sidebar-nav";
import { UpdateNotesSheet } from "@/update-notes/components/update-notes-sheet";
import { UpdateNotesProvider } from "@/update-notes/hooks/use-update-notes-sheet";

export function AuthenticatedShell({ children }: { children: ReactNode }) {
	return (
		<SessionFormProvider>
			<StackSheetProvider>
				<UpdateNotesProvider>
					<div className="min-h-svh bg-background">
						<SidebarNav />
						<div className="flex h-svh flex-col md:ml-56">
							<OnlineStatusBar />
							<div className="flex-1 overflow-auto pb-16 md:pb-0">
								{children}
							</div>
						</div>
						<MobileNav />
						<LiveStackFormSheet />
						<UpdateNotesSheet />
					</div>
				</UpdateNotesProvider>
			</StackSheetProvider>
		</SessionFormProvider>
	);
}
