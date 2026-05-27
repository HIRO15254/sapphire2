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
	 * Force the centered Dialog branch even on mobile. Use for confirmation
	 * prompts and other non-data-entry modals — the bottom-sheet idiom is
	 * reserved for data entry per the design system.
	 */
	forceDialog?: boolean;
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

interface FooterProps {
	cancelLabel: string;
	isPrimaryDisabled: boolean;
	onCancel: () => void;
	primaryAction: PrimaryAction;
}

function DialogFooter({
	cancelLabel,
	isPrimaryDisabled,
	onCancel,
	primaryAction,
}: FooterProps) {
	return (
		<div className="-mx-4 mt-2 -mb-4 flex items-center justify-end gap-2 border-t bg-muted/40 px-4 py-3">
			<Button onClick={onCancel} type="button" variant="ghost">
				{cancelLabel}
			</Button>
			<Button
				disabled={isPrimaryDisabled}
				form={primaryAction.form}
				onClick={primaryAction.onClick}
				type={primaryAction.form ? "submit" : "button"}
				variant={
					primaryAction.variant === "destructive" ? "destructive" : "default"
				}
			>
				{getPrimaryLabel(primaryAction)}
			</Button>
		</div>
	);
}

function SheetToolbar({
	cancelLabel,
	isPrimaryDisabled,
	onCancel,
	primaryAction,
	title,
}: FooterProps & { title: ReactNode }) {
	return (
		<div className="grid min-h-11 shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 border-b px-2">
			<button
				aria-label={cancelLabel}
				className="inline-flex size-9 items-center justify-center justify-self-start rounded-md text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40"
				onClick={onCancel}
				type="button"
			>
				<IconX size={18} />
			</button>
			<DrawerTitle className="min-w-0 truncate text-center font-semibold text-[length:var(--text-sm,0.8125rem)] text-foreground leading-tight">
				{title}
			</DrawerTitle>
			<button
				className={cn(
					"justify-self-end whitespace-nowrap rounded-sm px-2 py-2 font-semibold text-[length:var(--text-sm,0.8125rem)] outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-50",
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
	);
}

interface DrawerHeaderPlainProps {
	descriptionClassName: string | undefined;
	descriptionContent: ReactNode;
	headerAction?: ReactNode;
	onClose: () => void;
	title: ReactNode;
}

function DrawerHeaderPlain({
	descriptionClassName,
	descriptionContent,
	headerAction,
	onClose,
	title,
}: DrawerHeaderPlainProps) {
	return (
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
				onClick={onClose}
				size="sm"
				variant="ghost"
			>
				<IconX size={16} />
				<span className="sr-only">Close</span>
			</Button>
		</DrawerHeader>
	);
}

export function ResponsiveDialog({
	cancelLabel = "Cancel",
	children,
	contentClassName,
	description,
	forceDialog = false,
	fullHeight = false,
	headerAction,
	onOpenChange,
	open,
	primaryAction,
	title,
}: ResponsiveDialogProps) {
	const isDesktop = useMediaQuery("(min-width: 768px)");
	const renderAsDialog = forceDialog || isDesktop;
	const descriptionContent = description ?? "Dialog details";
	const descriptionClassName = description ? undefined : "sr-only";
	const onCancel = () => onOpenChange(false);
	const isPrimaryDisabled = !!(
		primaryAction &&
		(primaryAction.disabled || primaryAction.isLoading)
	);

	if (renderAsDialog) {
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
						<DialogFooter
							cancelLabel={cancelLabel}
							isPrimaryDisabled={isPrimaryDisabled}
							onCancel={onCancel}
							primaryAction={primaryAction}
						/>
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
						<SheetToolbar
							cancelLabel={cancelLabel}
							isPrimaryDisabled={isPrimaryDisabled}
							onCancel={onCancel}
							primaryAction={primaryAction}
							title={title}
						/>
						<DrawerDescription className={descriptionClassName}>
							{descriptionContent}
						</DrawerDescription>
					</>
				) : (
					<DrawerHeaderPlain
						descriptionClassName={descriptionClassName}
						descriptionContent={descriptionContent}
						headerAction={headerAction}
						onClose={onCancel}
						title={title}
					/>
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
