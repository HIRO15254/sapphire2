import type { ReactNode } from "react";
import {
	UpdateNotesProvider,
	UpdateNotesSheet,
} from "@/features/update-notes/components/update-notes-sheet";
import { MobileNav } from "@/shared/components/authenticated-shell/mobile-nav";
import { OnlineStatusBar } from "@/shared/components/authenticated-shell/online-status-bar";
import { SidebarNav } from "@/shared/components/authenticated-shell/sidebar-nav";
import { CRYST_SCOPE_CLASS } from "@/shared/components/cryst/cryst-scope";

export function AuthenticatedShell({ children }: { children: ReactNode }) {
	return (
		<UpdateNotesProvider>
			<div
				className={`${CRYST_SCOPE_CLASS} flex h-svh bg-background text-foreground`}
			>
				<SidebarNav />
				<div className="flex min-w-0 flex-1 flex-col">
					<OnlineStatusBar />
					<div className="min-h-0 flex-1 overflow-auto">{children}</div>
					<MobileNav />
				</div>
				<UpdateNotesSheet />
			</div>
		</UpdateNotesProvider>
	);
}
