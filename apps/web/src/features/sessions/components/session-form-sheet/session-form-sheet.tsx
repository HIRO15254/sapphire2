import { IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Button } from "@/shared/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";

interface SessionFormSheetProps {
	children: ReactNode;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}

/**
 * v2 full-height bottom sheet for the session wizard and tag manager.
 *
 * Unlike the shared {@link FormSheet}, this sheet has no `[✓]` submit button:
 * the {@link SessionWizard} drives its own multi-step navigation and final
 * submit, and the tag manager mutates inline. It still opens full height,
 * stays non-dismissible (so a stray swipe never discards in-progress wizard
 * input), and scopes the portal to `theme-v2`.
 */
export function SessionFormSheet({
	children,
	onOpenChange,
	open,
	title,
}: SessionFormSheetProps) {
	return (
		<Drawer dismissible={false} onOpenChange={onOpenChange} open={open}>
			<DrawerContent className="theme-v2 flex h-[calc(100svh-2rem)] flex-col rounded-t-xl">
				<div className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 border-b px-2 py-1.5">
					<Button
						aria-label="Close"
						className="justify-self-start"
						onClick={() => onOpenChange(false)}
						size="icon-lg"
						type="button"
						variant="ghost"
					>
						<IconX className="size-6" />
					</Button>
					<DrawerTitle className="t-h4 min-w-0 truncate text-center">
						{title}
					</DrawerTitle>
					<span aria-hidden className="size-10" />
				</div>
				<DrawerDescription className="sr-only">{title}</DrawerDescription>
				<div className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
					{children}
				</div>
			</DrawerContent>
		</Drawer>
	);
}
