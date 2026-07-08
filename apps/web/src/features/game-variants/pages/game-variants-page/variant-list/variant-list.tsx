import { ManagementList } from "@/shared/components/management/management-list";
import type { GameVariantRow } from "../types";
import { VariantRow } from "../variant-row";

interface VariantListProps {
	onArchive: (id: string) => void;
	onDelete: (variant: GameVariantRow) => void;
	onEdit: (variant: GameVariantRow) => void;
	onRestore: (id: string) => void;
	variants: GameVariantRow[];
}

export function VariantList({
	variants,
	onEdit,
	onArchive,
	onRestore,
	onDelete,
}: VariantListProps) {
	return (
		<ManagementList>
			{variants.map((variant) => (
				<VariantRow
					key={variant.id}
					onArchive={() => onArchive(variant.id)}
					onDelete={() => onDelete(variant)}
					onEdit={() => onEdit(variant)}
					onRestore={() => onRestore(variant.id)}
					variant={variant}
				/>
			))}
		</ManagementList>
	);
}
