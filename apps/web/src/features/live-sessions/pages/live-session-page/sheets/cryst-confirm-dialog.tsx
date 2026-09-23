import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { CRYST_SCRIM, crystButton } from "../cryst-controls";
import { CRYST_SCOPE_CLASS } from "../cryst-scope";

interface CrystConfirmDialogProps {
	cancelLabel: string;
	confirmLabel: string;
	description: ReactNode;
	isPending?: boolean;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}

export function CrystConfirmDialog({
	cancelLabel,
	confirmLabel,
	description,
	isPending = false,
	onConfirm,
	onOpenChange,
	open,
	title,
}: CrystConfirmDialogProps) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent
				className={cn(
					CRYST_SCOPE_CLASS,
					"w-[min(440px,calc(100vw-32px))] max-w-none gap-0 rounded-xl border border-border bg-popover p-0 text-popover-foreground shadow-[var(--shadow-lg)] ring-0 sm:max-w-none"
				)}
				overlayClassName={CRYST_SCRIM}
			>
				<DialogHeader className="gap-1 px-4 pt-4 pb-3.5">
					<DialogTitle className="pr-8 font-semibold text-[length:var(--text-base)] leading-tight tracking-[var(--tracking-heading)]">
						{title}
					</DialogTitle>
					<DialogDescription className="text-[length:var(--text-sm)]">
						{description}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="mx-0 mb-0 flex-row justify-end gap-2 rounded-none bg-transparent px-4 py-3">
					<button
						className={crystButton({ variant: "outline" })}
						onClick={() => onOpenChange(false)}
						type="button"
					>
						{cancelLabel}
					</button>
					<button
						className={crystButton({ variant: "destructive" })}
						disabled={isPending}
						onClick={onConfirm}
						type="button"
					>
						{confirmLabel}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
