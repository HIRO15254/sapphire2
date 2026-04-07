import { IconFilter } from "@tabler/icons-react";
import type * as React from "react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";

interface FilterDialogShellProps {
	activeCount: number;
	applyLabel?: string;
	buttonLabel?: string;
	children: React.ReactNode;
	description?: React.ReactNode;
	onApply: () => void;
	onOpen: () => void;
	onOpenChange: (open: boolean) => void;
	onReset: () => void;
	open: boolean;
	resetLabel?: string;
	title: string;
}

export function FilterDialogShell({
	activeCount,
	applyLabel = "Apply",
	buttonLabel = "Filter",
	children,
	description,
	onApply,
	onOpen,
	onOpenChange,
	onReset,
	open,
	resetLabel = "Reset",
	title,
}: FilterDialogShellProps) {
	return (
		<>
			<Button
				aria-label={
					activeCount > 0 ? `${buttonLabel} ${activeCount}` : buttonLabel
				}
				className="relative"
				onClick={onOpen}
				size="sm"
				variant="outline"
			>
				<IconFilter size={16} />
				{buttonLabel}
				{activeCount > 0 ? (
					<Badge className="ml-1 h-4 min-w-4 px-1 text-[10px]">
						{activeCount}
					</Badge>
				) : null}
			</Button>

			<ResponsiveDialog
				description={description}
				onOpenChange={onOpenChange}
				open={open}
				title={title}
			>
				<div className="flex flex-col gap-4">
					{children}
					<DialogActionRow className="sm:justify-stretch">
						<Button className="flex-1" onClick={onReset} variant="outline">
							{resetLabel}
						</Button>
						<Button className="flex-1" onClick={onApply}>
							{applyLabel}
						</Button>
					</DialogActionRow>
				</div>
			</ResponsiveDialog>
		</>
	);
}
