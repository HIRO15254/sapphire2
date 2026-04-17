import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import type { WidgetType } from "@/dashboard/hooks/use-dashboard-widgets";
import { listWidgetTypes } from "@/dashboard/widgets/registry";
import { Button } from "@/shared/components/ui/button";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";

interface AddWidgetMenuProps {
	disabled?: boolean;
	onSelect: (type: WidgetType) => void;
}

export function AddWidgetMenu({ onSelect, disabled }: AddWidgetMenuProps) {
	const [open, setOpen] = useState(false);
	const entries = listWidgetTypes();

	const handleSelect = (type: WidgetType) => {
		setOpen(false);
		onSelect(type);
	};

	return (
		<>
			<Button
				disabled={disabled}
				onClick={() => setOpen(true)}
				size="sm"
				variant="outline"
			>
				<IconPlus size={14} />
				Add Widget
			</Button>
			<ResponsiveDialog
				description="Choose a widget to add to your dashboard"
				onOpenChange={setOpen}
				open={open}
				title="Add widget"
			>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
			</ResponsiveDialog>
		</>
	);
}
