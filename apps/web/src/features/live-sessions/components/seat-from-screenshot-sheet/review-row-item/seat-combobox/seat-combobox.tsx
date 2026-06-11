import { IconChevronDown } from "@tabler/icons-react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useSeatCombobox } from "@/features/live-sessions/hooks/use-seat-combobox";
import type {
	PlayerOption,
	ReviewRow,
	RowAction,
} from "@/features/live-sessions/utils/seat-screenshot";
import { cn } from "@/lib/utils";
import {
	Command,
	CommandEmpty,
	CommandItem,
	CommandList,
} from "@/shared/components/ui/command";
import { Input } from "@/shared/components/ui/input";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@/shared/components/ui/popover";

function getSeatDisplayValue(row: ReviewRow): string {
	if (row.action === "hero") {
		return "Hero (self)";
	}
	return row.name;
}

export function SeatCombobox({
	allPlayers,
	disabled,
	heroAvailable,
	onActionChange,
	onNameChange,
	onSelectExisting,
	row,
}: {
	allPlayers: PlayerOption[];
	disabled: boolean;
	heroAvailable: boolean;
	onActionChange: (next: RowAction) => void;
	onNameChange: (next: string) => void;
	onSelectExisting: (player: PlayerOption) => void;
	row: ReviewRow;
}) {
	const { popoverOpen, setPopoverOpen, contentWidth, anchorRef } =
		useSeatCombobox();

	const displayValue = getSeatDisplayValue(row);
	const readOnly = row.action === "hero";
	const normalizedInput = row.name.trim().toLowerCase();
	const filteredPlayers = normalizedInput
		? allPlayers.filter((p) => p.name.toLowerCase().includes(normalizedInput))
		: allPlayers;
	const trimmedName = row.name.trim();

	const handleSelectExisting = (player: PlayerOption) => {
		onSelectExisting(player);
		setPopoverOpen(false);
	};

	const handlePickHero = () => {
		onActionChange("hero");
		setPopoverOpen(false);
	};

	const handleKeepAsNew = () => {
		onActionChange("new");
		setPopoverOpen(false);
	};

	const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Escape") {
			setPopoverOpen(false);
		}
	};

	return (
		<Popover modal={false} onOpenChange={setPopoverOpen} open={popoverOpen}>
			<PopoverAnchor asChild>
				<div className="relative flex-1" ref={anchorRef}>
					<Input
						aria-expanded={popoverOpen}
						autoComplete="off"
						className={cn(
							"h-8 pr-7",
							readOnly && "cursor-pointer text-muted-foreground"
						)}
						disabled={disabled}
						onChange={(e) => {
							if (readOnly) {
								return;
							}
							onNameChange(e.target.value);
							setPopoverOpen(true);
						}}
						onFocus={() => {
							if (!disabled) {
								setPopoverOpen(true);
							}
						}}
						onKeyDown={handleKeyDown}
						readOnly={readOnly}
						role="combobox"
						value={displayValue}
					/>
					<IconChevronDown
						className="pointer-events-none absolute top-2 right-2 text-muted-foreground"
						size={14}
					/>
				</div>
			</PopoverAnchor>
			{popoverOpen ? (
				<PopoverContent
					align="start"
					className="p-0"
					onFocusOutside={(e) => e.preventDefault()}
					onOpenAutoFocus={(e) => e.preventDefault()}
					onPointerDownOutside={(e) => {
						e.preventDefault();
					}}
					style={contentWidth ? { width: contentWidth } : undefined}
				>
					<Command shouldFilter={false}>
						<CommandList
							className="max-h-64 overflow-y-auto overscroll-contain"
							data-vaul-no-drag=""
							onTouchMove={(e) => e.stopPropagation()}
							onTouchStart={(e) => e.stopPropagation()}
							style={{ touchAction: "pan-y" }}
						>
							{heroAvailable && row.action !== "hero" ? (
								<CommandItem
									className={row.isHeroCandidate ? "text-amber-500" : ""}
									onMouseDown={(e) => e.preventDefault()}
									onSelect={handlePickHero}
									value="__hero__"
								>
									Seat Hero here
								</CommandItem>
							) : null}
							{trimmedName && row.action !== "new" ? (
								<CommandItem
									onMouseDown={(e) => e.preventDefault()}
									onSelect={handleKeepAsNew}
									value="__new__"
								>
									Create new: {trimmedName}
								</CommandItem>
							) : null}
							{filteredPlayers.length === 0 ? (
								<CommandEmpty>No matching players.</CommandEmpty>
							) : null}
							{filteredPlayers.map((p) => (
								<CommandItem
									key={p.id}
									onMouseDown={(e) => e.preventDefault()}
									onSelect={() => handleSelectExisting(p)}
									value={p.name}
								>
									{p.name}
								</CommandItem>
							))}
						</CommandList>
					</Command>
				</PopoverContent>
			) : null}
		</Popover>
	);
}
