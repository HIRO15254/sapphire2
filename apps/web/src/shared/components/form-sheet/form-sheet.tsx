import { IconCheck, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";

interface FormSheetProps {
	children: ReactNode;
	contentClassName?: string;
	formId: string;
	isLoading?: boolean;
	isSaveDisabled?: boolean;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}

export function FormSheet({
	children,
	contentClassName,
	formId,
	isLoading = false,
	isSaveDisabled = false,
	onOpenChange,
	open,
	title,
}: FormSheetProps) {
	return (
		<Drawer dismissible={false} onOpenChange={onOpenChange} open={open}>
			<DrawerContent
				className={cn("h-[calc(100svh-2rem)] rounded-t-xl", contentClassName)}
			>
				<div className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 border-b px-2 py-1.5">
					<Button
						aria-label="Cancel"
						className="justify-self-start"
						onClick={() => onOpenChange(false)}
						size="icon-lg"
						type="button"
						variant="ghost"
					>
						<IconX className="size-6" />
					</Button>
					<DrawerTitle className="t-h4 min-w-0 truncate text-center">
						{title}
					</DrawerTitle>
					<Button
						aria-label="Save"
						className="justify-self-end text-primary hover:text-primary"
						disabled={isLoading || isSaveDisabled}
						form={formId}
						size="icon-lg"
						type="submit"
						variant="ghost"
					>
						<IconCheck className="size-6" />
					</Button>
				</div>
				<DrawerDescription className="sr-only">{title}</DrawerDescription>
				<div className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
					{children}
				</div>
			</DrawerContent>
		</Drawer>
	);
}
