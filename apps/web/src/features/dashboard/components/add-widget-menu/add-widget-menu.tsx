import { IconPlus } from "@tabler/icons-react";
import type { WidgetType } from "@/features/dashboard/hooks/use-dashboard-widgets";
import { Button } from "@/shared/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { useAddWidgetMenu } from "./use-add-widget-menu";

interface AddWidgetMenuProps {
	disabled?: boolean;
	onSelect: (type: WidgetType) => void;
}

export function AddWidgetMenu({ onSelect, disabled }: AddWidgetMenuProps) {
	const { entries, handleOpen, handleSelect, open, setOpen } =
		useAddWidgetMenu(onSelect);

	return (
		<>
			<Button
				disabled={disabled}
				onClick={handleOpen}
				size="sm"
				variant="outline"
			>
				<IconPlus size={14} />
				Add widget
			</Button>
			<Drawer onOpenChange={setOpen} open={open}>
				<DrawerContent className="rounded-t-xl">
					<div
						aria-hidden
						className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
					/>
					<DrawerTitle className="sr-only">Add widget</DrawerTitle>
					<DrawerDescription className="sr-only">
						Choose a widget to add to your dashboard.
					</DrawerDescription>
					<div className="grid grid-cols-1 gap-3 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:grid-cols-2">
						{entries.map((entry) => {
							const Icon = entry.icon;
							return (
								<button
									className="flex items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-accent"
									key={entry.type}
									onClick={() => handleSelect(entry.type)}
									type="button"
								>
									<span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
										<Icon size={18} />
									</span>
									<span className="flex min-w-0 flex-col gap-0.5">
										<span className="font-medium text-sm">{entry.label}</span>
										<span className="text-muted-foreground text-xs leading-snug">
											{entry.description}
										</span>
									</span>
								</button>
							);
						})}
					</div>
				</DrawerContent>
			</Drawer>
		</>
	);
}
