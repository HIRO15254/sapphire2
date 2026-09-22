import { IconLoader2 } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
	CrystSheetFrame,
	SHEET_ACTION_CLASS,
	SHEET_BODY_CLASS,
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
					className={cn(
						SHEET_ACTION_CLASS,
						"font-medium text-muted-foreground"
					)}
					onClick={() => onOpenChange(false)}
					type="button"
				>
					Cancel
				</button>
			}
			className={cn("h-auto", className)}
			confirm={
				<button
					aria-busy={isLoading}
					className={cn(SHEET_ACTION_CLASS, "font-semibold text-primary")}
					disabled={isLoading || isSaveDisabled}
					form={formId}
					type="submit"
				>
					{isLoading ? (
						<IconLoader2 aria-hidden className="animate-spin" size={16} />
					) : null}
					Save
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
