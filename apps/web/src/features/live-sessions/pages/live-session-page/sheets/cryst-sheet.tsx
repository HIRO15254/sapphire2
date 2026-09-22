import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { CRYST_FOCUS_RING, CRYST_SCRIM } from "../cryst-controls";
import { CRYST_SCOPE_CLASS } from "../cryst-scope";

const SHEET_SURFACE =
	"mx-auto max-h-[85svh] w-full max-w-[560px] rounded-t-[var(--m-sheet-radius)] border-border border-b-0 bg-popover text-popover-foreground shadow-[var(--shadow-lg)]";

const SHEET_TITLE_CLASS =
	"min-w-0 truncate text-center font-semibold text-[length:var(--m-text-title)] leading-tight tracking-[var(--tracking-heading)]";

export const SHEET_ICON_CLASS = `inline-flex size-[var(--m-control)] items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 ${CRYST_FOCUS_RING}`;

type CrystSheetFrameProps = {
	children: ReactNode;
	className?: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
} & (
	| { cancel?: never; confirm?: never; dismissible: true }
	| { cancel: ReactNode; confirm: ReactNode; dismissible: false }
);

export function CrystSheetFrame({
	cancel,
	children,
	className,
	confirm,
	dismissible,
	onOpenChange,
	open,
	title,
}: CrystSheetFrameProps) {
	return (
		<Drawer dismissible={dismissible} onOpenChange={onOpenChange} open={open}>
			<DrawerContent
				className={cn(CRYST_SCOPE_CLASS, SHEET_SURFACE, className)}
				overlayClassName={CRYST_SCRIM}
			>
				{dismissible ? (
					<>
						<div
							aria-hidden
							className="flex shrink-0 cursor-grab justify-center pt-2 pb-1.5"
						>
							<span className="h-1 w-9 rounded-full bg-input" />
						</div>
						<div className="shrink-0 border-border border-b px-[var(--m-inset)] pb-2.5">
							<DrawerTitle className={SHEET_TITLE_CLASS}>{title}</DrawerTitle>
						</div>
					</>
				) : (
					<div className="grid min-h-[var(--m-navbar-height)] shrink-0 grid-cols-[1fr_minmax(0,auto)_1fr] items-center border-border border-b px-1 py-0.5">
						<div className="justify-self-start">{cancel}</div>
						<DrawerTitle className={SHEET_TITLE_CLASS}>{title}</DrawerTitle>
						<div className="justify-self-end">{confirm}</div>
					</div>
				)}
				<DrawerDescription className="sr-only">{title}</DrawerDescription>
				{children}
			</DrawerContent>
		</Drawer>
	);
}

export const SHEET_BODY_CLASS =
	"flex-1 overflow-y-auto px-[var(--m-inset)] pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-[length:var(--m-text-secondary)]";

interface CrystSheetProps {
	children: ReactNode;
	className?: string;
	header?: ReactNode;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}

export function CrystSheet({
	children,
	className,
	header,
	onOpenChange,
	open,
	title,
}: CrystSheetProps) {
	return (
		<CrystSheetFrame
			className={className}
			dismissible
			onOpenChange={onOpenChange}
			open={open}
			title={title}
		>
			{header === undefined ? null : (
				<div className="shrink-0 border-border border-b px-[var(--m-inset)] pt-2 pb-2">
					{header}
				</div>
			)}
			<div className={SHEET_BODY_CLASS}>{children}</div>
		</CrystSheetFrame>
	);
}
