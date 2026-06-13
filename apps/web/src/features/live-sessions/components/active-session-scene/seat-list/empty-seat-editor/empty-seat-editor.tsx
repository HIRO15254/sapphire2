import { IconSearch, IconUser, IconUserQuestion } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
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
import { PlayerTagBadges } from "../player-tag-badges";
import { useEmptySeatEditor } from "./use-empty-seat-editor";

interface EmptySeatEditorProps {
	excludePlayerIds: string[];
	/** Show the hero quick-action — only when no hero seat is set yet. */
	heroAvailable: boolean;
	onAddExisting: (playerId: string, playerName: string) => void;
	onAddNew: (values: { name: string }) => void;
	onAddTemporary: () => void;
	onSeatHero: () => void;
}

/**
 * Always-on combobox for seating an empty seat: the search field is shown
 * inline on the row, with hero / temporary seating as quick-action icons
 * beside it. Typing filters players by name or tag; the dropdown seats an
 * existing player or creates one by name — each in a single tap.
 */
export function EmptySeatEditor({
	excludePlayerIds,
	heroAvailable,
	onAddExisting,
	onAddNew,
	onAddTemporary,
	onSeatHero,
}: EmptySeatEditorProps) {
	const {
		anchorRef,
		canCreate,
		contentWidth,
		matches,
		onCreate,
		onHero,
		onSelectExisting,
		onTemporary,
		open,
		query,
		setOpen,
		setQuery,
		trimmed,
	} = useEmptySeatEditor({
		excludePlayerIds,
		onAddExisting,
		onAddNew,
		onAddTemporary,
		onSeatHero,
	});

	return (
		<div className="flex items-center gap-1">
			<Popover modal={false} onOpenChange={setOpen} open={open}>
				<PopoverAnchor asChild>
					<div className="relative flex-1" ref={anchorRef}>
						<IconSearch
							className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
							size={16}
						/>
						<Input
							aria-expanded={open}
							aria-label="Search or seat a player"
							autoComplete="off"
							className="h-8 pl-9"
							onChange={(e) => {
								setQuery(e.target.value);
								setOpen(true);
							}}
							onFocus={() => setOpen(true)}
							role="combobox"
							value={query}
						/>
					</div>
				</PopoverAnchor>
				{open ? (
					<PopoverContent
						align="start"
						className="p-0"
						onOpenAutoFocus={(e) => e.preventDefault()}
						onPointerDownOutside={(e) => {
							if (anchorRef.current?.contains(e.target as Node | null)) {
								e.preventDefault();
							}
						}}
						style={contentWidth ? { width: contentWidth } : undefined}
					>
						<Command shouldFilter={false}>
							<CommandList className="max-h-64 overflow-y-auto overscroll-contain">
								{canCreate ? (
									<CommandItem
										onMouseDown={(e) => e.preventDefault()}
										onSelect={onCreate}
										value="__create__"
									>
										<IconUser
											className="mr-2 shrink-0 text-muted-foreground"
											size={16}
										/>
										Create "{trimmed}"
									</CommandItem>
								) : null}
								{matches.length === 0 ? (
									<CommandEmpty>No matching players</CommandEmpty>
								) : null}
								{matches.map((player) => (
									<CommandItem
										key={player.id}
										onMouseDown={(e) => e.preventDefault()}
										onSelect={() => onSelectExisting(player)}
										value={player.id}
									>
										<span className="flex min-w-0 flex-1 items-center gap-2">
											<span className="min-w-0 shrink truncate font-medium text-sm">
												{player.name}
											</span>
											<PlayerTagBadges tags={player.tags} />
										</span>
									</CommandItem>
								))}
							</CommandList>
						</Command>
					</PopoverContent>
				) : null}
			</Popover>

			{heroAvailable ? (
				<Button
					aria-label="Seat hero here"
					className="shrink-0 border-amber-500 text-amber-600 hover:bg-amber-500/10 hover:text-amber-600 dark:text-amber-500"
					onClick={onHero}
					size="icon-sm"
					type="button"
					variant="outline"
				>
					<IconUser size={18} />
				</Button>
			) : null}
			<Button
				aria-label="Seat temporary player"
				className="shrink-0"
				onClick={onTemporary}
				size="icon-sm"
				type="button"
				variant="outline"
			>
				<IconUserQuestion size={18} />
			</Button>
		</div>
	);
}
