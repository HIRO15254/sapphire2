import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { CRYST_SCOPE_CLASS } from "../cryst-scope";

interface CrystSheetProps {
	children: ReactNode;
	className?: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}

export function CrystSheet({
	children,
	className,
	onOpenChange,
	open,
	title,
}: CrystSheetProps) {
	return (
		<Drawer onOpenChange={onOpenChange} open={open}>
			<DrawerContent
				className={cn(
					CRYST_SCOPE_CLASS,
					"max-h-[85svh] rounded-t-xl",
					className
				)}
			>
				<div
					aria-hidden
					className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
				/>
				<div className="px-4">
					<DrawerTitle className="t-h4">{title}</DrawerTitle>
					<DrawerDescription className="sr-only">{title}</DrawerDescription>
				</div>
				<div className="flex-1 overflow-y-auto px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
					{children}
				</div>
			</DrawerContent>
		</Drawer>
	);
}
