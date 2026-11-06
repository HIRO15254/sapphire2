import { IconCheck, IconLoader2, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import {
	Drawer,
	DrawerBody,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { IconButton } from "@/shared/components/ui/icon-button";
import { useFormSheet } from "./use-form-sheet";

interface FormSheetProps {
	children: ReactNode;
	className?: string;
	confirmLabel?: string;
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
	confirmLabel = "Save",
	formId,
	isLoading = false,
	isSaveDisabled = false,
	onOpenChange,
	open,
	title,
}: FormSheetProps) {
	const { onCancel } = useFormSheet(onOpenChange);
	return (
		<Drawer dismissible={false} onOpenChange={onOpenChange} open={open}>
			<DrawerContent className={className}>
				<div className="border-border grid min-h-[var(--m-navbar-height)] shrink-0 grid-cols-[1fr_minmax(0,auto)_1fr] items-center border-b px-1 py-0.5">
					<IconButton
						className="text-foreground justify-self-start [&_svg:not([class*='size-'])]:size-6"
						label="Cancel"
						onClick={onCancel}
						size="xl"
						type="button"
					>
						<IconX aria-hidden />
					</IconButton>
					<DrawerTitle className="text-center">{title}</DrawerTitle>
					<IconButton
						aria-busy={isLoading}
						className="text-primary-text hover:text-primary-text justify-self-end [&_svg:not([class*='size-'])]:size-6"
						disabled={isLoading || isSaveDisabled}
						form={formId}
						label={confirmLabel}
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
				<DrawerBody>{children}</DrawerBody>
			</DrawerContent>
		</Drawer>
	);
}
