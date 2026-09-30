import { IconDeviceMobile } from "@tabler/icons-react";
import type { ReactNode } from "react";
import {
	UpdateNotesProvider,
	UpdateNotesSheet,
} from "@/features/update-notes/components/update-notes-sheet";
import { cn } from "@/lib/utils";
import { MobileNav } from "@/shared/components/authenticated-shell/mobile-nav";
import { OnlineStatusBar } from "@/shared/components/authenticated-shell/online-status-bar";
import { SidebarNav } from "@/shared/components/authenticated-shell/sidebar-nav";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { useAuthenticatedShell } from "./use-authenticated-shell";

export function AuthenticatedShell({
	children,
	fullBleed = false,
}: {
	children: ReactNode;
	fullBleed?: boolean;
}) {
	const { isDesktop, activeSessionId } = useAuthenticatedShell();
	const showMobileNav = !fullBleed || activeSessionId === null;

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
		<UpdateNotesProvider>
			<div className="min-h-svh bg-background">
				<SidebarNav />
				<div className="flex h-svh flex-col md:ml-56">
					<OnlineStatusBar />
					<div
						className={cn(
							"flex-1",
							showMobileNav &&
								"pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0",
							fullBleed ? "min-h-0" : "overflow-auto"
						)}
					>
						{children}
					</div>
				</div>
				{showMobileNav ? <MobileNav /> : null}
				<UpdateNotesSheet />
			</div>
		</UpdateNotesProvider>
	);
}
