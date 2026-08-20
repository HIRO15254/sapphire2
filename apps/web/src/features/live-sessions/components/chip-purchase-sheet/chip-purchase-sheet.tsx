import { Button } from "@/shared/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { formatCompactNumber } from "@/utils/format-number";

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

export function ChipPurchaseSheet({
	open,
	onOpenChange,
	onSubmit,
	options,
}: ChipPurchaseSheetProps) {
	return (
		<Drawer onOpenChange={onOpenChange} open={open}>
			<DrawerContent className="rounded-t-xl">
				<div
					aria-hidden
					className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
				/>
				<DrawerTitle className="sr-only">Add Chip Purchase</DrawerTitle>
				<DrawerDescription className="sr-only">
					Pick a chip purchase defined in this tournament's rules.
				</DrawerDescription>
				<div className="overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
				</div>
			</DrawerContent>
		</Drawer>
	);
}
