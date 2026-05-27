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
 * When provided, the mobile drawer header renders the Sapphire 2 bottom
 * sheet toolbar (`[Cancel] Title [Confirm]`, iOS pattern), and the desktop
 * dialog gets a Cancel/Save footer. The X-close affordance is removed in
 * both cases since Cancel takes over the dismiss role.
 *
 * `form` opts the primary button into native HTML form submission via the
 * `form` attribute, so the action can live outside the `<form>` element.
 *
 * `variant: "destructive"` colors the primary label with the destructive
 * token — used for irreversible confirmations (delete, sign out, discard).
 */
interface PrimaryAction {
	disabled?: boolean;
	form?: string;
	isLoading?: boolean;
	label: string;
	loadingLabel?: string;
	onClick?: () => void;
	variant?: "default" | "destructive";
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
								variant={
									primaryAction.variant === "destructive"
										? "destructive"
										: "default"
								}
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
				className={cn(
					"rounded-t-xl",
					fullHeight && "h-[calc(100svh-2rem)]",
					contentClassName
				)}
			>
				{primaryAction ? (
					<>
						<div className="grid min-h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b px-3">
							<button
								className="justify-self-start whitespace-nowrap rounded-sm px-1 py-2 text-foreground text-sm outline-none hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
								onClick={() => onOpenChange(false)}
								type="button"
							>
								{cancelLabel}
							</button>
							<DrawerTitle className="min-w-0 truncate text-center text-foreground text-sm leading-tight">
								{title}
							</DrawerTitle>
							<button
								className={cn(
									"justify-self-end whitespace-nowrap rounded-sm px-1 py-2 font-semibold text-sm outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-50",
									primaryAction.variant === "destructive"
										? "text-destructive"
										: "text-primary"
								)}
								disabled={isPrimaryDisabled}
								form={primaryAction.form}
								onClick={primaryAction.onClick}
								type={primaryAction.form ? "submit" : "button"}
							>
								{getPrimaryLabel(primaryAction)}
							</button>
						</div>
						<DrawerDescription className={descriptionClassName}>
							{descriptionContent}
						</DrawerDescription>
					</>
				) : (
					<DrawerHeader className="relative shrink-0">
						<div className="flex items-center gap-2">
							<DrawerTitle>{title}</DrawerTitle>
							{headerAction}
						</div>
						<DrawerDescription className={descriptionClassName}>
							{descriptionContent}
						</DrawerDescription>
						<Button
							className="absolute top-2 right-2"
							onClick={() => onOpenChange(false)}
							size="sm"
							variant="ghost"
						>
							<IconX size={16} />
							<span className="sr-only">Close</span>
						</Button>
					</DrawerHeader>
				)}
				<div
					className={cn(
						"flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]",
						primaryAction ? "pt-4" : ""
					)}
				>
					{children}
				</div>
			</DrawerContent>
		</Drawer>
	);
}
