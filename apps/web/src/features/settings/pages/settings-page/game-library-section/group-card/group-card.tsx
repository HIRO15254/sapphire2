import { IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import type {
	GameGroupEntry,
	GameGroupRow,
	GameVariantRow,
} from "../use-game-library-section";

export interface GroupCardProps {
	entry: GameGroupEntry;
	onAddVariant: (groupId: string) => void;
	onDeleteGroup: (group: GameGroupRow) => void;
	onDeleteVariant: (variant: GameVariantRow) => void;
	onEditGroup: (group: GameGroupRow) => void;
	onEditVariant: (variant: GameVariantRow) => void;
}

function slotLabelsSummary(group: GameGroupRow): string {
	const labels = [
		group.blind1Label,
		group.blind2Label,
		group.blind3Label,
	].filter(Boolean);
	return labels.length > 0 ? labels.join(" / ") : "Default labels";
}

/**
 * One card per game group with its variants listed inside — makes "every
 * variant belongs to exactly one group" visible (mix-game rework). Pure
 * presentational: all state and mutations live in the parent's
 * use-game-library-section.ts hook and the two form-sheet hooks.
 */
export function GroupCard({
	entry,
	onAddVariant,
	onDeleteGroup,
	onDeleteVariant,
	onEditGroup,
	onEditVariant,
}: GroupCardProps) {
	const { group, variants } = entry;

	return (
		<div className="rounded-md border">
			<div className="flex items-center justify-between gap-2 px-3 py-2">
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<p className="truncate font-medium text-sm">{group.label}</p>
						{group.builtinKey ? (
							<Badge variant="secondary">Default</Badge>
						) : null}
					</div>
					<p className="truncate text-muted-foreground text-xs">
						{slotLabelsSummary(group)}
					</p>
				</div>
				<div className="flex shrink-0 gap-1">
					<Button
						aria-label={`Edit ${group.label}`}
						onClick={() => onEditGroup(group)}
						size="icon-xs"
						type="button"
						variant="ghost"
					>
						<IconEdit size={14} />
					</Button>
					<Button
						aria-label={`Delete ${group.label}`}
						className="text-muted-foreground hover:text-destructive"
						onClick={() => onDeleteGroup(group)}
						size="icon-xs"
						type="button"
						variant="ghost"
					>
						<IconTrash size={14} />
					</Button>
				</div>
			</div>

			<div className="divide-y border-t">
				{variants.length === 0 ? (
					<p className="px-3 py-4 text-center text-muted-foreground text-sm">
						No variants in this group yet.
					</p>
				) : (
					variants.map((variant) => (
						<div
							className="flex items-center justify-between gap-2 px-3 py-2"
							key={variant.id}
						>
							<div className="flex min-w-0 items-center gap-2">
								<p className="truncate text-sm">{variant.label}</p>
								{variant.shortLabel ? (
									<span className="truncate text-muted-foreground text-xs">
										{variant.shortLabel}
									</span>
								) : null}
								{variant.builtinKey ? (
									<Badge variant="secondary">Default</Badge>
								) : null}
							</div>
							<div className="flex shrink-0 gap-1">
								<Button
									aria-label={`Edit ${variant.label}`}
									onClick={() => onEditVariant(variant)}
									size="icon-xs"
									type="button"
									variant="ghost"
								>
									<IconEdit size={14} />
								</Button>
								<Button
									aria-label={`Delete ${variant.label}`}
									className="text-muted-foreground hover:text-destructive"
									onClick={() => onDeleteVariant(variant)}
									size="icon-xs"
									type="button"
									variant="ghost"
								>
									<IconTrash size={14} />
								</Button>
							</div>
						</div>
					))
				)}
			</div>

			<div className="border-t px-3 py-2">
				<Button
					onClick={() => onAddVariant(group.id)}
					size="sm"
					type="button"
					variant="ghost"
				>
					<IconPlus size={16} />
					Add variant
				</Button>
			</div>
		</div>
	);
}
