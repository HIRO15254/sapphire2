import { IconCheck, IconLoader2, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
	CrystSheetFrame,
	SHEET_BODY_CLASS,
	SHEET_ICON_CLASS,
} from "./cryst-sheet";

interface CrystFormSheetProps {
	children: ReactNode;
	className?: string;
	formId: string;
	isLoading?: boolean;
	isSaveDisabled?: boolean;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}

export function CrystFormSheet({
	children,
	className,
	formId,
	isLoading = false,
	isSaveDisabled = false,
	onOpenChange,
	open,
	title,
}: CrystFormSheetProps) {
	return (
		<CrystSheetFrame
			cancel={
				<button
					aria-label="Cancel"
					className={SHEET_ICON_CLASS}
					onClick={() => onOpenChange(false)}
					type="button"
				>
					<IconX aria-hidden size={24} />
				</button>
			}
			className={cn("h-auto", className)}
			confirm={
				<button
					aria-busy={isLoading}
					aria-label="Save"
					className={cn(SHEET_ICON_CLASS, "text-primary")}
					disabled={isLoading || isSaveDisabled}
					form={formId}
					type="submit"
				>
					{isLoading ? (
						<IconLoader2 aria-hidden className="animate-spin" size={24} />
					) : (
						<IconCheck aria-hidden size={24} />
					)}
				</button>
			}
			dismissible={false}
			onOpenChange={onOpenChange}
			open={open}
			title={title}
		>
			<div className={SHEET_BODY_CLASS}>{children}</div>
		</CrystSheetFrame>
	);
}
