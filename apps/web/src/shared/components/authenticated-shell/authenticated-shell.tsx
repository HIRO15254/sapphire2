import { IconDeviceMobile } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { LiveStackFormSheet } from "@/features/live-sessions/components/live-stack-form-sheet";
import { EventMenuProvider } from "@/features/live-sessions/hooks/use-event-menu";
import { SessionFormProvider } from "@/features/live-sessions/hooks/use-session-form";
import { StackSheetProvider } from "@/features/live-sessions/hooks/use-stack-sheet";
import {
	UpdateNotesProvider,
	UpdateNotesSheet,
} from "@/features/update-notes/components/update-notes-sheet";
import { MobileNav } from "@/shared/components/authenticated-shell/mobile-nav";
import { OnlineStatusBar } from "@/shared/components/authenticated-shell/online-status-bar";
import { SidebarNav } from "@/shared/components/authenticated-shell/sidebar-nav";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { useAuthenticatedShell } from "./use-authenticated-shell";

export function AuthenticatedShell({ children }: { children: ReactNode }) {
	const { isDesktop } = useAuthenticatedShell();

	if (isDesktop) {
		return (
			<div className="flex min-h-svh items-center justify-center bg-background p-6">
				<EmptyState
					className="max-w-md"
					description="This app is optimized for mobile. Open it on a smartphone to continue."
					heading="Use on your phone"
					icon={<IconDeviceMobile size={48} stroke={1.5} />}
				/>
			</div>
		);
	}

	return (
		<SessionFormProvider>
			<StackSheetProvider>
				<EventMenuProvider>
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
				</EventMenuProvider>
			</StackSheetProvider>
		</SessionFormProvider>
	);
}
