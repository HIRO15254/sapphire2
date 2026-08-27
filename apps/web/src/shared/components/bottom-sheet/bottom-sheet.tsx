import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { CRYST_SCOPE } from "@/shared/lib/theme";

interface BottomSheetProps {
	cancelLabel?: string;
	children: ReactNode;
	confirmLabel?: string;
	contentClassName?: string;
	description?: string;
	dismissible?: boolean;
	formId?: string;
	isConfirmDisabled?: boolean;
	isConfirmPending?: boolean;
	onCancel?: () => void;
	onConfirm?: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
	variant?: "form" | "menu";
}

const HEADER_BUTTON_CLASS =
	"min-h-[var(--tap-target)] min-w-0 truncate rounded-[var(--radius-md)] px-2 py-1 font-sans text-base";

export function BottomSheet({
	cancelLabel,
	children,
	confirmLabel,
	contentClassName,
	description,
	dismissible = true,
	formId,
	isConfirmDisabled = false,
	isConfirmPending = false,
	onCancel,
	onConfirm,
	onOpenChange,
	open,
	title,
	variant = "form",
}: BottomSheetProps) {
	const showConfirm =
		confirmLabel !== undefined &&
		(onConfirm !== undefined || formId !== undefined);
	const isMenu = variant === "menu";
	return (
		<Drawer dismissible={dismissible} onOpenChange={onOpenChange} open={open}>
			<DrawerContent
				className={cn(
					CRYST_SCOPE,
					"max-h-[calc(100svh-2rem)] rounded-t-[var(--m-sheet-radius)] border-border bg-background text-foreground",
					contentClassName
				)}
				overlayClassName="bg-black/50 backdrop-blur-[4px]"
			>
				<div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35" />
				{isMenu ? (
					<DrawerTitle className="sr-only">{title}</DrawerTitle>
				) : (
					<div className="grid shrink-0 grid-cols-[minmax(64px,auto)_1fr_minmax(64px,auto)] items-center gap-1 px-2 py-1">
						{cancelLabel === undefined ? (
							<span />
						) : (
							<button
								className={cn(
									HEADER_BUTTON_CLASS,
									"justify-self-start text-foreground hover:bg-muted"
								)}
								onClick={onCancel ?? (() => onOpenChange(false))}
								type="button"
							>
								{cancelLabel}
							</button>
						)}
						<DrawerTitle className="min-w-0 truncate text-center font-semibold text-base tracking-[var(--tracking-heading)]">
							{title}
						</DrawerTitle>
						{showConfirm ? (
							<button
								className={cn(
									HEADER_BUTTON_CLASS,
									"justify-self-end font-semibold text-primary hover:bg-muted disabled:opacity-50"
								)}
								disabled={isConfirmDisabled || isConfirmPending}
								form={formId}
								onClick={formId === undefined ? onConfirm : undefined}
								type={formId === undefined ? "button" : "submit"}
							>
								{confirmLabel}
							</button>
						) : (
							<span />
						)}
					</div>
				)}
				<DrawerDescription className="sr-only">
					{description ?? title}
				</DrawerDescription>
				<div
					className={cn(
						"flex-1 overflow-y-auto px-[var(--m-inset)]",
						isMenu
							? "pt-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
							: "pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]"
					)}
				>
					{children}
				</div>
			</DrawerContent>
		</Drawer>
	);
}
