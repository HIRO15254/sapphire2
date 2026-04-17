import { IconEdit, IconTrash, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
	ExpandableItem,
	ExpandableItemList,
} from "@/shared/components/management/expandable-item-list";
import { Button } from "@/shared/components/ui/button";

interface EntityListItemProps {
	children: React.ReactNode;
	className?: string;
	contentClassName?: string;
	deleteLabel: string;
	expandedValue?: string | null;
	onDelete: () => void;
	onEdit: () => void;
	onExpandedValueChange?: (value: string | null) => void;
	summary: React.ReactNode;
	summaryClassName?: string;
}

export function EntityListItem({
	children,
	className,
	contentClassName,
	deleteLabel,
	expandedValue: controlledExpandedValue,
	onDelete,
	onEdit,
	onExpandedValueChange,
	summary,
	summaryClassName,
}: EntityListItemProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [internalExpandedValue, setInternalExpandedValue] = useState<
		string | null
	>(null);

	const isControlled = controlledExpandedValue !== undefined;
	const expandedValue = isControlled
		? controlledExpandedValue
		: internalExpandedValue;

	return (
		<ExpandableItemList
			className={cn("rounded-lg border bg-card", className)}
			onValueChange={(nextValue) => {
				if (!isControlled) {
					setInternalExpandedValue(nextValue);
				}
				setConfirmingDelete(false);
				onExpandedValueChange?.(nextValue);
			}}
			value={expandedValue}
		>
			<ExpandableItem
				className="border-b-0"
				contentClassName="pb-0"
				summary={summary}
				summaryClassName={cn(
					"px-3 py-3 [&[data-state=open]]:border-b",
					summaryClassName
				)}
				value="details"
			>
				<div className={cn("space-y-3 px-3 py-3", contentClassName)}>
					{children}
					<div className="flex flex-wrap items-center justify-end gap-1 border-t pt-3">
						{confirmingDelete ? (
							<>
								<span className="mr-auto text-destructive text-xs">
									Delete this {deleteLabel}?
								</span>
								<Button
									aria-label="Confirm delete"
									className="text-destructive hover:text-destructive"
									onClick={(event) => {
										event.stopPropagation();
										onDelete();
										setConfirmingDelete(false);
										if (!isControlled) {
											setInternalExpandedValue(null);
										}
										onExpandedValueChange?.(null);
									}}
									size="xs"
									type="button"
									variant="ghost"
								>
									<IconTrash size={14} />
									Delete
								</Button>
								<Button
									aria-label="Cancel delete"
									onClick={(event) => {
										event.stopPropagation();
										setConfirmingDelete(false);
									}}
									size="xs"
									type="button"
									variant="ghost"
								>
									<IconX size={14} />
									Cancel
								</Button>
							</>
						) : (
							<>
								<Button
									onClick={(event) => {
										event.stopPropagation();
										onEdit();
									}}
									size="xs"
									type="button"
									variant="ghost"
								>
									<IconEdit size={14} />
									Edit
								</Button>
								<Button
									className="text-destructive hover:text-destructive"
									onClick={(event) => {
										event.stopPropagation();
										setConfirmingDelete(true);
									}}
									size="xs"
									type="button"
									variant="ghost"
								>
									<IconTrash size={14} />
									Delete
								</Button>
							</>
						)}
					</div>
				</div>
			</ExpandableItem>
		</ExpandableItemList>
	);
}
