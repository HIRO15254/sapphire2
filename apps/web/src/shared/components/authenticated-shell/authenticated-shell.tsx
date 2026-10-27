import { IconDeviceMobile } from "@tabler/icons-react";
import type { ReactNode } from "react";
import {
	UpdateNotesProvider,
	UpdateNotesSheet,
} from "@/features/update-notes/components/update-notes-sheet";
import { MobileNav } from "@/shared/components/authenticated-shell/mobile-nav";
import { OnlineStatusBar } from "@/shared/components/authenticated-shell/online-status-bar";
import { CRYST_SCOPE_CLASS } from "@/shared/components/cryst/cryst-scope";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/shared/components/ui/empty";
import { useAuthenticatedShell } from "./use-authenticated-shell";

export function AuthenticatedShell({ children }: { children: ReactNode }) {
	const { isDesktop } = useAuthenticatedShell();

	if (isDesktop) {
		return (
			<Empty className={`${CRYST_SCOPE_CLASS} min-h-svh bg-background p-6`}>
				<EmptyHeader>
					<EmptyMedia>
						<IconDeviceMobile aria-hidden />
					</EmptyMedia>
					<EmptyTitle>Use on your phone</EmptyTitle>
					<EmptyDescription>
						This app is optimized for mobile. Open it on a smartphone to
						continue.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<UpdateNotesProvider>
			<div
				className={`${CRYST_SCOPE_CLASS} flex h-svh flex-col bg-background text-foreground`}
			>
				<OnlineStatusBar />
				<div className="min-h-0 flex-1 overflow-auto">{children}</div>
				<MobileNav />
				<UpdateNotesSheet />
			</div>
		</UpdateNotesProvider>
	);
}
