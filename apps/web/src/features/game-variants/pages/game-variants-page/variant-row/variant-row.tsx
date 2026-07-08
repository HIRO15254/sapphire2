import {
	IconArchive,
	IconArchiveOff,
	IconEdit,
	IconTrash,
} from "@tabler/icons-react";
import { ManagementListItem } from "@/shared/components/management/management-list";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import type { GameVariantRow } from "../types";

interface VariantRowProps {
	onArchive: () => void;
	onDelete: () => void;
	onEdit: () => void;
	onRestore: () => void;
	variant: GameVariantRow;
}

function buildMetaLine(variant: GameVariantRow): string {
	return [variant.blindLabel1, variant.blindLabel2, variant.blindLabel3]
		.filter((label): label is string => Boolean(label))
		.join(" / ");
}

export function VariantRow({
	variant,
	onEdit,
	onArchive,
	onRestore,
	onDelete,
}: VariantRowProps) {
	const isArchived = variant.archivedAt !== null;
	const meta = buildMetaLine(variant);

	return (
		<ManagementListItem
			actions={
				<div className="flex gap-1">
					<Button
						aria-label={`Edit ${variant.name}`}
						onClick={onEdit}
						size="icon-sm"
						variant="ghost"
					>
						<IconEdit size={16} />
					</Button>
					{isArchived ? (
						<Button
							aria-label={`Restore ${variant.name}`}
							onClick={onRestore}
							size="icon-sm"
							variant="ghost"
						>
							<IconArchiveOff size={16} />
						</Button>
					) : (
						<Button
							aria-label={`Archive ${variant.name}`}
							onClick={onArchive}
							size="icon-sm"
							variant="ghost"
						>
							<IconArchive size={16} />
						</Button>
					)}
					<Button
						aria-label={`Delete ${variant.name}`}
						className="text-destructive hover:text-destructive"
						onClick={onDelete}
						size="icon-sm"
						variant="ghost"
					>
						<IconTrash size={16} />
					</Button>
				</div>
			}
			description={meta || undefined}
			title={<Badge>{variant.name}</Badge>}
		/>
	);
}
