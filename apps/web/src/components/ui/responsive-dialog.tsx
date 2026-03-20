import { IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useCallback, useRef } from "react";
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
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}

function preventInteraction(e: Event) {
	e.preventDefault();
}

export function ResponsiveDialog({
	children,
	onOpenChange,
	open,
	title,
}: ResponsiveDialogProps) {
	const isDesktop = useMediaQuery("(min-width: 768px)");
	const intentionalClose = useRef(false);

	const handleDrawerOpenChange = useCallback(
		(newOpen: boolean) => {
			if (!(newOpen || intentionalClose.current)) {
				return;
			}
			intentionalClose.current = false;
			onOpenChange(newOpen);
		},
		[onOpenChange]
	);

	const handleClose = useCallback(() => {
		intentionalClose.current = true;
		onOpenChange(false);
	}, [onOpenChange]);

	if (isDesktop) {
		return (
			<Dialog onOpenChange={onOpenChange} open={open}>
				<DialogContent
					onEscapeKeyDown={preventInteraction}
					onInteractOutside={preventInteraction}
					onPointerDownOutside={preventInteraction}
				>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
					</DialogHeader>
					{children}
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Drawer onOpenChange={handleDrawerOpenChange} open={open}>
			<DrawerContent>
				<DrawerHeader className="relative">
					<DrawerTitle>{title}</DrawerTitle>
					<Button
						className="absolute top-2 right-2"
						onClick={handleClose}
						size="sm"
						variant="ghost"
					>
						<IconX size={16} />
						<span className="sr-only">Close</span>
					</Button>
				</DrawerHeader>
				<div className="px-4 pb-4">{children}</div>
			</DrawerContent>
		</Drawer>
	);
}
