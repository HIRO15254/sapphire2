import { IconCheck, IconLoader2, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CRYST_SCOPE_CLASS } from "@/shared/components/cryst/cryst-scope";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { IconButton } from "@/shared/components/ui/icon-button";

interface FormSheetProps {
	children: ReactNode;
	className?: string;
	formId: string;
	isLoading?: boolean;
	isSaveDisabled?: boolean;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}

export function FormSheet({
	children,
	className,
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
				className={cn(
					CRYST_SCOPE_CLASS,
					"h-auto max-h-[calc(100svh-2rem)] rounded-t-xl",
					className
				)}
			>
				<div className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 border-b px-2 py-1.5">
					<IconButton
						className="justify-self-start"
						label="Cancel"
						onClick={() => onOpenChange(false)}
						size="xl"
						type="button"
					>
						<IconX aria-hidden />
					</IconButton>
					<DrawerTitle className="t-h4 min-w-0 truncate text-center">
						{title}
					</DrawerTitle>
					<IconButton
						aria-busy={isLoading}
						className="justify-self-end text-primary-text hover:text-primary-text"
						disabled={isLoading || isSaveDisabled}
						form={formId}
						label="Save"
						size="xl"
						type="submit"
					>
						{isLoading ? (
							<IconLoader2 aria-hidden className="animate-spin" />
						) : (
							<IconCheck aria-hidden />
						)}
					</IconButton>
				</div>
				<DrawerDescription className="sr-only">{title}</DrawerDescription>
				<div className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
					{children}
				</div>
			</DrawerContent>
		</Drawer>
	);
}
