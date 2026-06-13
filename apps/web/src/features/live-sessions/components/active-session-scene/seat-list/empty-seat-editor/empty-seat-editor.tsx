import {
	IconSearch,
	IconUserPlus,
	IconUserQuestion,
} from "@tabler/icons-react";
import { Badge } from "@/shared/components/ui/badge";
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
import { useEmptySeatEditor } from "./use-empty-seat-editor";

interface EmptySeatEditorProps {
	excludePlayerIds: string[];
	onAddExisting: (playerId: string, playerName: string) => void;
	onAddNew: (values: { name: string }) => void;
	onAddTemporary: () => void;
}

/**
 * Always-on combobox for seating an empty seat: the search field is shown
 * inline on the row (no expansion). Typing filters players by name or tag, and
 * the dropdown lets the user seat an existing player, create one by name, or
 * seat a temporary player — each in a single tap.
 */
export function EmptySeatEditor({
	excludePlayerIds,
	onAddExisting,
	onAddNew,
	onAddTemporary,
}: EmptySeatEditorProps) {
	const {
		anchorRef,
		canCreate,
		contentWidth,
		matches,
		onCreate,
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
	});

	return (
		<Popover modal={false} onOpenChange={setOpen} open={open}>
			<PopoverAnchor asChild>
				<div className="relative" ref={anchorRef}>
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
									<IconUserPlus
										className="mr-2 shrink-0 text-muted-foreground"
										size={16}
									/>
									Create "{trimmed}"
								</CommandItem>
							) : null}
							<CommandItem
								onMouseDown={(e) => e.preventDefault()}
								onSelect={onTemporary}
								value="__temp__"
							>
								<IconUserQuestion
									className="mr-2 shrink-0 text-muted-foreground"
									size={16}
								/>
								Add temporary player
							</CommandItem>
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
									<span className="min-w-0 flex-1">
										<span className="truncate font-medium text-sm">
											{player.name}
										</span>
										{player.tags.length > 0 ? (
											<span className="mt-0.5 flex flex-wrap gap-1">
												{player.tags.map((tag) => (
													<Badge
														key={tag.id}
														style={{
															borderColor: tag.color,
															color: tag.color,
														}}
														variant="outline"
													>
														{tag.name}
													</Badge>
												))}
											</span>
										) : null}
									</span>
								</CommandItem>
							))}
						</CommandList>
					</Command>
				</PopoverContent>
			) : null}
		</Popover>
	);
}
