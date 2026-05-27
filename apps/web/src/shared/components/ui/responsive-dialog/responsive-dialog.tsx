import { IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { useMediaQuery } from "@/shared/hooks/use-media-query";

/**
 * Primary (save) action displayed in the dialog/drawer chrome.
 *
 * When provided, the mobile drawer header switches to an iOS-style
 * `[Cancel]  Title  [Save]` layout — the trailing X-close is removed
 * (Cancel button takes over the dismiss role). On desktop, a sticky
 * footer with the same Cancel/Save pair is added under the body.
 *
 * If `form` is given, the button renders as `type="submit" form={form}`
 * so an external form (one with the matching `id`) is submitted natively
 * — Save can live outside the `<form>` element this way.
 */
interface PrimaryAction {
	disabled?: boolean;
	form?: string;
	isLoading?: boolean;
	label: string;
	loadingLabel?: string;
	onClick?: () => void;
}

interface ResponsiveDialogProps {
	cancelLabel?: string;
	children: ReactNode;
	/**
	 * Class applied to the portal root (DialogContent / DrawerContent).
	 * Use this to scope the portal into a theme (e.g. `theme-v2`) so its
	 * tokens cascade into the dialog content, since portals render outside
	 * the page's theme subtree. See `.claude/rules/web-theme.md`.
	 */
	contentClassName?: string;
	description?: ReactNode;
	/**
	 * When true, the mobile Drawer always uses maximum height.
	 * Use for content with dynamic height (e.g., editable tables).
	 */
	fullHeight?: boolean;
	headerAction?: ReactNode;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	primaryAction?: PrimaryAction;
	title: ReactNode;
}

function getPrimaryLabel(action: PrimaryAction): string {
	if (action.isLoading) {
		return action.loadingLabel ?? "Saving...";
	}
	return action.label;
}

export function ResponsiveDialog({
	cancelLabel = "Cancel",
	children,
	contentClassName,
	description,
	fullHeight = false,
	headerAction,
	onOpenChange,
	open,
	primaryAction,
	title,
}: ResponsiveDialogProps) {
	const isDesktop = useMediaQuery("(min-width: 768px)");
	const descriptionContent = description ?? "Dialog details";
	const descriptionClassName = description ? undefined : "sr-only";
	const isPrimaryDisabled = !!(
		primaryAction &&
		(primaryAction.disabled || primaryAction.isLoading)
	);

	if (isDesktop) {
		return (
			<Dialog onOpenChange={onOpenChange} open={open}>
				<DialogContent
					className={cn("max-h-[85vh] overflow-y-auto", contentClassName)}
					showCloseButton={!primaryAction}
				>
					<DialogHeader>
						<div className="flex items-center gap-2">
							<DialogTitle>{title}</DialogTitle>
							{headerAction}
						</div>
						<DialogDescription className={descriptionClassName}>
							{descriptionContent}
						</DialogDescription>
					</DialogHeader>
					{children}
					{primaryAction ? (
						<div className="-mx-4 mt-2 -mb-4 flex items-center justify-end gap-2 border-t bg-muted/40 px-4 py-3">
							<Button
								onClick={() => onOpenChange(false)}
								type="button"
								variant="ghost"
							>
								{cancelLabel}
							</Button>
							<Button
								disabled={isPrimaryDisabled}
								form={primaryAction.form}
								onClick={primaryAction.onClick}
								type={primaryAction.form ? "submit" : "button"}
							>
								{getPrimaryLabel(primaryAction)}
							</Button>
						</div>
					) : null}
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Drawer dismissible={false} onOpenChange={onOpenChange} open={open}>
			<DrawerContent
				className={cn(fullHeight && "h-[calc(100svh-2rem)]", contentClassName)}
			>
				<DrawerHeader className="relative shrink-0">
					<div
						className={cn(
							"flex items-center gap-2",
							primaryAction && "justify-center px-12 text-center"
						)}
					>
						<DrawerTitle>{title}</DrawerTitle>
						{headerAction}
					</div>
					<DrawerDescription className={descriptionClassName}>
						{descriptionContent}
					</DrawerDescription>
					{primaryAction ? (
						<>
							<Button
								aria-label={cancelLabel}
								className="absolute top-2 left-2"
								onClick={() => onOpenChange(false)}
								size="icon-sm"
								type="button"
								variant="ghost"
							>
								<IconX size={16} />
							</Button>
							<Button
								className="absolute top-2 right-2"
								disabled={isPrimaryDisabled}
								form={primaryAction.form}
								onClick={primaryAction.onClick}
								size="sm"
								type={primaryAction.form ? "submit" : "button"}
							>
								{getPrimaryLabel(primaryAction)}
							</Button>
						</>
					) : (
						<Button
							className="absolute top-2 right-2"
							onClick={() => onOpenChange(false)}
							size="sm"
							variant="ghost"
						>
							<IconX size={16} />
							<span className="sr-only">Close</span>
						</Button>
					)}
				</DrawerHeader>
				<div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
					{children}
				</div>
			</DrawerContent>
		</Drawer>
	);
}
