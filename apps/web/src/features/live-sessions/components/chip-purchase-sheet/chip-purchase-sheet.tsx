import { Button } from "@/shared/components/ui/button";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { formatCompactNumber } from "@/utils/format-number";

export interface ChipPurchaseOption {
	chips: number;
	cost: number;
	/** The session_chip_purchase id this purchase links to. */
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
	/** Rule-defined chip purchases for this session to pick from. */
	options: ChipPurchaseOption[];
}

/**
 * Picker for recording a chip purchase during a live tournament. The user
 * picks one of the session's rule-defined chip purchases; name / cost /
 * chips come from the rule and the event links to it via its id. There is
 * no free-form entry — chip purchases are defined in the session rules.
 */
export function ChipPurchaseSheet({
	open,
	onOpenChange,
	onSubmit,
	options,
}: ChipPurchaseSheetProps) {
	return (
		<ResponsiveDialog
			description="Pick a chip purchase defined in this tournament's rules."
			onOpenChange={onOpenChange}
			open={open}
			title="Add Chip Purchase"
		>
			{options.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					No chip purchases are defined for this tournament. Add them to the
					session rules first.
				</p>
			) : (
				<div className="flex flex-col gap-2">
					{options.map((option) => (
						<Button
							className="h-auto justify-between py-3"
							key={option.id}
							onClick={() =>
								onSubmit({
									sessionChipPurchaseId: option.id,
									name: option.name,
									cost: option.cost,
									chips: option.chips,
								})
							}
							type="button"
							variant="outline"
						>
							<span className="font-medium">{option.name}</span>
							<span className="text-muted-foreground text-sm">
								{formatCompactNumber(option.cost)} →{" "}
								{formatCompactNumber(option.chips)} chips
							</span>
						</Button>
					))}
				</div>
			)}
		</ResponsiveDialog>
	);
}
