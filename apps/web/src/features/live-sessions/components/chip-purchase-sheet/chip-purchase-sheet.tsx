import { IconRefresh, IconStackPush } from "@tabler/icons-react";
import { BottomSheet } from "@/shared/components/bottom-sheet";
import { Button } from "@/shared/components/ui/button";
import { formatNumber } from "@/utils/format-number";

export interface ChipPurchaseOption {
	chips: number;
	cost: number;
	id: string;
	name: string;
}

interface ChipPurchaseSheetProps {
	onOpenChange: (open: boolean) => void;
	onSubmit: (purchase: {
		chips: number;
		cost: number;
		name: string;
		sessionChipPurchaseId: string;
	}) => void;
	open: boolean;
	options: ChipPurchaseOption[];
}

const ADDON_NAME_PATTERN = /add-?on/i;

function ChipPurchaseOptionRow({
	onPick,
	option,
}: {
	onPick: () => void;
	option: ChipPurchaseOption;
}) {
	const Icon = ADDON_NAME_PATTERN.test(option.name)
		? IconStackPush
		: IconRefresh;
	return (
		<Button
			className="h-auto w-full items-center justify-start gap-2.5 rounded-lg border-border px-3 py-2.5 text-left"
			onClick={onPick}
			type="button"
			variant="outline"
		>
			<Icon className="size-4 shrink-0 text-muted-foreground" />
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="font-semibold text-sm">{option.name}</span>
				<span className="text-[11px] text-muted-foreground">
					+{formatNumber(option.chips)}chips
				</span>
			</span>
			<span className="font-mono text-sm">{formatNumber(option.cost)}</span>
		</Button>
	);
}

export function ChipPurchaseSheet({
	open,
	onOpenChange,
	onSubmit,
	options,
}: ChipPurchaseSheetProps) {
	return (
		<BottomSheet
			cancelLabel="Cancel"
			description="Pick a chip purchase defined in this tournament's rules."
			onOpenChange={onOpenChange}
			open={open}
			title="Chip purchase"
			variant="form"
		>
			{options.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					No chip purchases are defined for this tournament. Add them to the
					session rules first.
				</p>
			) : (
				<div className="flex flex-col gap-2">
					{options.map((option) => (
						<ChipPurchaseOptionRow
							key={option.id}
							onPick={() =>
								onSubmit({
									sessionChipPurchaseId: option.id,
									name: option.name,
									cost: option.cost,
									chips: option.chips,
								})
							}
							option={option}
						/>
					))}
				</div>
			)}
		</BottomSheet>
	);
}
