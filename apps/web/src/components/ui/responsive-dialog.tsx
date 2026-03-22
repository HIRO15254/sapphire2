import { IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";

interface ResponsiveDialogProps {
	children: ReactNode;
	/**
	 * When true, the mobile Drawer always uses maximum height.
	 * Use for content with dynamic height (e.g., editable tables).
	 */
	fullHeight?: boolean;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}

export function ResponsiveDialog({
	children,
	fullHeight = false,
	onOpenChange,
	open,
	title,
}: ResponsiveDialogProps) {
	const isDesktop = useMediaQuery("(min-width: 768px)");

	if (isDesktop) {
		return (
			<Dialog onOpenChange={onOpenChange} open={open}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
					</DialogHeader>
					{children}
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Drawer dismissible={false} onOpenChange={onOpenChange} open={open}>
			<DrawerContent
				className={fullHeight ? "h-[calc(100svh-2rem)]" : undefined}
			>
				<DrawerHeader className="relative shrink-0">
					<DrawerTitle>{title}</DrawerTitle>
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
				<div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
					{children}
				</div>
			</DrawerContent>
		</Drawer>
	);
}
