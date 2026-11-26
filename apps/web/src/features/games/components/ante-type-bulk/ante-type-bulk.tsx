import { ANTE_TYPE_OPTIONS } from "@/features/games/utils/stakes";
import { Badge } from "@/shared/components/ui/badge";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/shared/components/ui/toggle-group";
import {
	type UseAnteTypeBulkOptions,
	useAnteTypeBulk,
} from "./use-ante-type-bulk";

export function AnteTypeBulk(props: UseAnteTypeBulkOptions) {
	const { cards } = useAnteTypeBulk(props);

	return (
		<div className="flex flex-col gap-2">
			<h3 className="text-muted-foreground m-0 text-[11px] font-semibold tracking-[var(--tracking-caps)] uppercase">
				Ante type
			</h3>
			{cards.map((card) => (
				<section
					aria-label={`${card.name} ante type`}
					className="bg-card border-border flex flex-col gap-2 rounded-lg border p-3"
					key={card.key}
				>
					<div className="flex items-center gap-2">
						<span className="font-semibold">{card.name}</span>
						<span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs">
							{card.games}
						</span>
						{card.mixed ? <Badge variant="warning">Mixed</Badge> : null}
					</div>
					<ToggleGroup
						aria-label={`Ante type for ${card.name} on every level`}
						disabled={card.locked}
						onValueChange={card.onApply}
						role="radiogroup"
						type="single"
						value={card.value}
					>
						{ANTE_TYPE_OPTIONS.map((option) => (
							<ToggleGroupItem key={option.value} value={option.value}>
								{option.label}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
					{card.note ? (
						<p className="text-muted-foreground m-0 leading-normal text-[length:var(--m-text-footnote)]">
							{card.note}
						</p>
					) : null}
				</section>
			))}
		</div>
	);
}
