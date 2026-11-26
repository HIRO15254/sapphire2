import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import type {
	GameGroup,
	GameVariant,
} from "@/features/games/hooks/use-game-masters";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
	Drawer,
	DrawerBody,
	DrawerContent,
	DrawerGrab,
	DrawerHeader,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { Field } from "@/shared/components/ui/field";
import { IconButton } from "@/shared/components/ui/icon-button";
import { Input } from "@/shared/components/ui/input";
import { useGamesPicker } from "./use-games-picker";

interface GamesPickerProps {
	groups: GameGroup[] | undefined;
	onChange: (next: string[]) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	value: string[];
	variants: GameVariant[];
}

export function GamesPicker({
	groups,
	onChange,
	onOpenChange,
	open,
	value,
	variants,
}: GamesPickerProps) {
	const {
		countText,
		onOpenChange: onPickerOpenChange,
		onQueryChange,
		onToggleAll,
		onToggleGame,
		onToggleOpen,
		query,
		sections,
	} = useGamesPicker({ groups, onChange, onOpenChange, value, variants });

	return (
		<Drawer
			onOpenChange={onPickerOpenChange}
			open={open}
			shouldScaleBackground={false}
		>
			<DrawerContent aria-describedby={undefined}>
				<DrawerGrab />
				<DrawerHeader>
					<DrawerTitle>Games</DrawerTitle>
				</DrawerHeader>
				<DrawerBody className="flex flex-col gap-2.5 pt-0.5">
					<Field htmlFor="games-picker-search" label="Search">
						<Input
							id="games-picker-search"
							onChange={onQueryChange}
							size="xl"
							type="search"
							value={query}
						/>
					</Field>
					<p className="text-muted-foreground m-0 leading-normal text-[length:var(--m-text-footnote)]">
						{countText}
					</p>
					{sections.map((section) => (
						<div
							className="bg-card border-border flex shrink-0 flex-col overflow-hidden rounded-lg border"
							key={section.id}
						>
							<div className="flex min-h-11 items-center gap-2.5 pr-0.5 pl-3">
								<Checkbox
									aria-label={`All ${section.title} games`}
									checked={section.allChecked}
									className="min-w-0 flex-1 font-semibold"
									label={section.title}
									onCheckedChange={onToggleAll(section.ids)}
									size="xl"
								/>
								<span className="text-muted-foreground font-mono text-xs">
									{section.count}
								</span>
								<IconButton
									label={`${section.open ? "Hide" : "Show"} ${section.title} games`}
									onClick={onToggleOpen(section.id)}
									size="xl"
									type="button"
								>
									{section.open ? (
										<IconChevronUp aria-hidden />
									) : (
										<IconChevronDown aria-hidden />
									)}
								</IconButton>
							</div>
							{section.open
								? section.rows.map((row) => (
										<div
											className="border-border flex min-h-10 items-center gap-2.5 border-t px-3"
											key={row.id}
										>
											<Checkbox
												checked={row.checked}
												className="flex-1"
												label={row.label}
												onCheckedChange={onToggleGame(row.id)}
												size="xl"
											/>
											<span className="text-muted-foreground font-mono text-xs">
												{row.short}
											</span>
										</div>
									))
								: null}
						</div>
					))}
				</DrawerBody>
			</DrawerContent>
		</Drawer>
	);
}
