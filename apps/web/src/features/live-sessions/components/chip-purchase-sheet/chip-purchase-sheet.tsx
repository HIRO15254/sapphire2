import { IconRefresh, IconStackPush } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { formatNumber } from "@/utils/format-number";

export interface ChipPurchaseOption {
	chips: number;
	cost: number;
	id: string;
	name: string;
}

interface ChipPurchaseSheetProps {
	contentClassName?: string;
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

function ChipPurchaseOptionRow({
	index,
	onPick,
	option,
}: {
	index: number;
	onPick: () => void;
	option: ChipPurchaseOption;
}) {
	const Icon = index === 0 ? IconRefresh : IconStackPush;
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
	contentClassName,
	open,
	onOpenChange,
	onSubmit,
	options,
}: ChipPurchaseSheetProps) {
	return (
		<Drawer onOpenChange={onOpenChange} open={open}>
			<DrawerContent
				className={cn("rounded-t-[var(--m-sheet-radius)]", contentClassName)}
			>
				<div
					aria-hidden
					className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
				/>
				<DrawerTitle className="mt-2 text-center font-semibold text-base tracking-[var(--tracking-heading)]">
					Chip purchase
				</DrawerTitle>
				<DrawerDescription className="sr-only">
					Pick a chip purchase defined in this tournament's rules.
				</DrawerDescription>
				<div className="overflow-y-auto p-[var(--m-inset)] pb-[calc(1rem+env(safe-area-inset-bottom))]">
					{options.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							No chip purchases are defined for this tournament. Add them to the
							session rules first.
						</p>
					) : (
						<div className="flex flex-col gap-2">
							{options.map((option, index) => (
								<ChipPurchaseOptionRow
									index={index}
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
				</div>
			</DrawerContent>
		</Drawer>
	);
}
