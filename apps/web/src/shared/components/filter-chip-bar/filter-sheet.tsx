import type { ReactNode } from "react";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";

interface FilterSheetProps {
	children: ReactNode;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}

/**
 * The bottom sheet a filter chip opens to pick its value. A drag-handled
 * `Drawer` with a visible `t-h4` title (hybrid picker pattern from
 * `web-theme.md`), holding the option list / date inputs passed as children.
 */
export function FilterSheet({
	children,
	onOpenChange,
	open,
	title,
}: FilterSheetProps) {
	return (
		<Drawer onOpenChange={onOpenChange} open={open}>
			<DrawerContent className="rounded-t-xl">
				<div
					aria-hidden
					className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
				/>
				<DrawerTitle className="t-h4 px-4 pt-1">{title}</DrawerTitle>
				<DrawerDescription className="sr-only">
					Select a {title.toLowerCase()} filter option.
				</DrawerDescription>
				<div className="flex flex-col gap-1 overflow-y-auto px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
					{children}
				</div>
			</DrawerContent>
		</Drawer>
	);
}
