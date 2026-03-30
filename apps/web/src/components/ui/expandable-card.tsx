import { IconEdit, IconTrash, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExpandableCardProps {
	children: React.ReactNode;
	className?: string;
	collapseOnDelete?: boolean;
	deleteLabel: string;
	expanded?: boolean;
	header: React.ReactNode;
	onDelete: () => void;
	onEdit: () => void;
	onExpandedChange?: (expanded: boolean) => void;
}

export function ExpandableCard({
	children,
	className,
	collapseOnDelete = true,
	deleteLabel,
	expanded: controlledExpanded,
	header,
	onDelete,
	onEdit,
	onExpandedChange,
}: ExpandableCardProps) {
	const [internalExpanded, setInternalExpanded] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	const isControlled =
		controlledExpanded !== undefined && onExpandedChange !== undefined;
	const isExpanded = isControlled ? controlledExpanded : internalExpanded;

	const handleToggle = () => {
		const next = !isExpanded;
		if (isControlled) {
			onExpandedChange(next);
		} else {
			setInternalExpanded(next);
		}
		setConfirmingDelete(false);
	};

	const handleDelete = () => {
		onDelete();
		setConfirmingDelete(false);
		if (collapseOnDelete) {
			if (isControlled) {
				onExpandedChange(false);
			} else {
				setInternalExpanded(false);
			}
		}
	};

	return (
		<div className={cn("rounded-lg border bg-card", className)}>
			<button
				aria-expanded={isExpanded}
				className="flex w-full cursor-pointer items-start gap-2 p-3 text-left"
				onClick={handleToggle}
				type="button"
			>
				{header}
			</button>

			<div
				className={`grid transition-[grid-template-rows] duration-200 ease-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
			>
				<div className="overflow-hidden">
					<div className="border-t px-3 py-2">
						{children}

						{confirmingDelete ? (
							<div className="mt-2 flex items-center justify-end gap-1 border-t pt-2">
								<span className="text-destructive text-xs">
									Delete this {deleteLabel}?
								</span>
								<Button
									aria-label="Confirm delete"
									className="text-destructive hover:text-destructive"
									onClick={handleDelete}
									size="xs"
									variant="ghost"
								>
									<IconTrash size={14} />
									Delete
								</Button>
								<Button
									aria-label="Cancel delete"
									onClick={() => setConfirmingDelete(false)}
									size="xs"
									variant="ghost"
								>
									<IconX size={14} />
									Cancel
								</Button>
							</div>
						) : (
							<div className="mt-2 flex items-center justify-end gap-1 border-t pt-2">
								<Button onClick={onEdit} size="xs" variant="ghost">
									<IconEdit size={14} />
									Edit
								</Button>
								<Button
									className="text-destructive hover:text-destructive"
									onClick={() => setConfirmingDelete(true)}
									size="xs"
									variant="ghost"
								>
									<IconTrash size={14} />
									Delete
								</Button>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
