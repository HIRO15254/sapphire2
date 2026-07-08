import type { GameVariantRow } from "../types";
import { VariantList } from "../variant-list";
import { VariantListSkeleton } from "../variant-list-skeleton";

interface VariantContentProps {
	activeVariants: GameVariantRow[];
	archivedVariants: GameVariantRow[];
	isLoading: boolean;
	onArchive: (id: string) => void;
	onDelete: (variant: GameVariantRow) => void;
	onEdit: (variant: GameVariantRow) => void;
	onRestore: (id: string) => void;
	showArchived: boolean;
}

export function VariantContent({
	activeVariants,
	archivedVariants,
	isLoading,
	onArchive,
	onDelete,
	onEdit,
	onRestore,
	showArchived,
}: VariantContentProps) {
	if (isLoading) {
		return <VariantListSkeleton />;
	}

	return (
		<>
			{activeVariants.length === 0 && !showArchived ? (
				<p className="py-6 text-center text-muted-foreground text-sm">
					No game variants yet.
				</p>
			) : null}
			{activeVariants.length > 0 ? (
				<VariantList
					onArchive={onArchive}
					onDelete={onDelete}
					onEdit={onEdit}
					onRestore={onRestore}
					variants={activeVariants}
				/>
			) : null}
			{showArchived ? (
				<div className="mt-1 flex flex-col gap-2 border-border border-t border-dashed pt-3">
					<p className="t-meta uppercase tracking-wide">Archived</p>
					{archivedVariants.length === 0 ? (
						<p className="py-2 text-center text-muted-foreground text-xs">
							No archived game variants.
						</p>
					) : (
						<VariantList
							onArchive={onArchive}
							onDelete={onDelete}
							onEdit={onEdit}
							onRestore={onRestore}
							variants={archivedVariants}
						/>
					)}
				</div>
			) : null}
		</>
	);
}
