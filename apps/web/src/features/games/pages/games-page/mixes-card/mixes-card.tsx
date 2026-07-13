import { IconEdit, IconTrash } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
import type { GameMixRow, GameVariantRow } from "../use-games-page";

export interface MixesCardProps {
	mixes: GameMixRow[];
	onDeleteMix: (mix: GameMixRow) => void;
	onEditMix: (mix: GameMixRow) => void;
	variants: GameVariantRow[];
}

function mixGamesSummary(
	mix: GameMixRow,
	labelById: Map<string, string>
): string {
	const labels = mix.games
		.map((id) => labelById.get(id))
		.filter((label): label is string => Boolean(label))
		.join(", ");
	return labels
		? `${mix.games.length} games: ${labels}`
		: `${mix.games.length} games`;
}

/**
 * Card listing the user's mix masters (label + ordered game composition,
 * spanning groups) — rendered after the group cards since a mix is a
 * cross-group composition, not a group member. Same header-band treatment
 * as `group-card/` for visual consistency. Pure presentational: state and
 * mutations live in the parent's use-games-page.ts hook and the
 * shared mix-form-sheet hook.
 */
export function MixesCard({
	mixes,
	onDeleteMix,
	onEditMix,
	variants,
}: MixesCardProps) {
	const labelById = new Map(
		variants.map((variant) => [variant.id, variant.label])
	);

	return (
		<div className="rounded-md border">
			<div className="rounded-t-md bg-muted/50 px-3 py-2">
				<p className="font-semibold text-sm">Mixes</p>
			</div>

			<div className="divide-y border-t">
				{mixes.length === 0 ? (
					<p className="px-3 py-4 text-center text-muted-foreground text-sm">
						No mixes yet.
					</p>
				) : (
					mixes.map((mix) => (
						<div
							className="flex items-center justify-between gap-2 px-3 py-2"
							key={mix.id}
						>
							<div className="min-w-0">
								<p className="truncate font-medium text-sm">{mix.label}</p>
								<p className="truncate text-muted-foreground text-xs">
									{mixGamesSummary(mix, labelById)}
								</p>
							</div>
							<div className="flex shrink-0 gap-1">
								<Button
									aria-label={`Edit ${mix.label}`}
									onClick={() => onEditMix(mix)}
									size="icon-xs"
									type="button"
									variant="ghost"
								>
									<IconEdit size={14} />
								</Button>
								<Button
									aria-label={`Delete ${mix.label}`}
									className="text-destructive"
									onClick={() => onDeleteMix(mix)}
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
		</div>
	);
}
