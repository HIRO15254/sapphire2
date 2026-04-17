import { IconPlus } from "@tabler/icons-react";
import type { WidgetType } from "@/dashboard/hooks/use-dashboard-widgets";
import { listWidgetTypes } from "@/dashboard/widgets/registry";
import { Button } from "@/shared/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

interface AddWidgetMenuProps {
	disabled?: boolean;
	onSelect: (type: WidgetType) => void;
}

export function AddWidgetMenu({ onSelect, disabled }: AddWidgetMenuProps) {
	const entries = listWidgetTypes();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button disabled={disabled} size="sm" variant="outline">
					<IconPlus size={14} />
					Add Widget
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{entries.map((entry) => {
					const Icon = entry.icon;
					return (
						<DropdownMenuItem
							key={entry.type}
							onSelect={() => onSelect(entry.type)}
						>
							<Icon size={14} />
							<div className="flex flex-col">
								<span>{entry.label}</span>
								<span className="text-muted-foreground text-xs">
									{entry.description}
								</span>
							</div>
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
