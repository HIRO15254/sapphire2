import { IconCheck, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";

interface FormSheetProps {
	children: ReactNode;
	/**
	 * Optional override applied to the portal root (DrawerContent). Pass
	 * `theme-v2` (or another scope class) so the portal subtree inherits
	 * the right tokens — see `.claude/rules/web-theme.md`.
	 */
	contentClassName?: string;
	/**
	 * Stable id of the form that the confirm button submits via the HTML
	 * `form` attribute. Lets Save live in the drawer chrome instead of
	 * inside the `<form>` element.
	 */
	formId: string;
	isLoading?: boolean;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}

/**
 * V2 bottom sheet for data entry — per the design contract in
 * `.claude/rules/web-theme.md`:
 *
 * - Opens at full height so the keyboard doesn't compress the form.
 * - iOS-style toolbar header: `[X] Title [✓]`. Left X = cancel,
 *   right check = submit; both are icon-only buttons.
 * - Not dismissible by overlay tap or swipe-down — losing in-progress
 *   input on a stray tap is worse than the extra cancel tap.
 * - No drag handle (would mislead given the sheet isn't dismissible
 *   by swipe).
 */
export function FormSheet({
	children,
	contentClassName,
	formId,
	isLoading = false,
	onOpenChange,
	open,
	title,
}: FormSheetProps) {
	return (
		<Drawer dismissible={false} onOpenChange={onOpenChange} open={open}>
			<DrawerContent
				className={cn("h-[calc(100svh-2rem)] rounded-t-xl", contentClassName)}
			>
				<div className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 border-b px-2 py-1.5">
					<Button
						aria-label="Cancel"
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
					<Button
						aria-label="Save"
						className="justify-self-end text-primary hover:text-primary"
						disabled={isLoading}
						form={formId}
						size="icon-lg"
						type="submit"
						variant="ghost"
					>
						<IconCheck className="size-6" />
					</Button>
				</div>
				<DrawerDescription className="sr-only">{title}</DrawerDescription>
				<div className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
					{children}
				</div>
			</DrawerContent>
		</Drawer>
	);
}
