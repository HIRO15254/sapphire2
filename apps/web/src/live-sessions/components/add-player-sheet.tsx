import { IconPlus, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { PlayerFormValues } from "@/players/components/player-form";
import { PlayerForm } from "@/players/components/player-form";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { trpc } from "@/utils/trpc";

interface TagWithColor {
	color: string;
	id: string;
	name: string;
}

interface AddPlayerSheetProps {
	availableTags: TagWithColor[];
	excludePlayerIds: string[];
	onAddExisting: (playerId: string, playerName: string) => void;
	onAddNew: (values: { memo?: string | null; name: string; tagIds?: string[] }) => void;
	onCreateTag: (name: string) => Promise<TagWithColor>;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function AddPlayerSheet({
	availableTags,
	excludePlayerIds,
	onAddExisting,
	onAddNew,
	onCreateTag,
	onOpenChange,
	open,
}: AddPlayerSheetProps) {
	const [tab, setTab] = useState<"existing" | "new">("existing");
	const [search, setSearch] = useState("");

	useEffect(() => {
		if (open) {
			setTab("existing");
			setSearch("");
		}
	}, [open]);

	const playersQuery = useQuery({
		...trpc.player.list.queryOptions({}),
		enabled: open,
	});

	const allPlayers = playersQuery.data ?? [];
	const excludeSet = new Set(excludePlayerIds);
	const availablePlayers = allPlayers.filter((p) => !excludeSet.has(p.id));
	const filteredPlayers = search
		? availablePlayers.filter((p) =>
				p.name.toLowerCase().includes(search.toLowerCase())
			)
		: availablePlayers;

	const handleAddExisting = (playerId: string, playerName: string) => {
		onAddExisting(playerId, playerName);
		onOpenChange(false);
	};

	const handleAddNew = (values: PlayerFormValues) => {
		onAddNew({
			memo: values.memo,
			name: values.name,
			tagIds: values.tagIds,
		});
		onOpenChange(false);
	};

	return (
		<ResponsiveDialog
			fullHeight
			onOpenChange={onOpenChange}
			open={open}
			title="Add Player"
		>
			<div className="flex flex-col gap-3">
				<Tabs
					onValueChange={(value) => setTab(value as "existing" | "new")}
					value={tab}
				>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="existing">Existing</TabsTrigger>
						<TabsTrigger value="new">New Player</TabsTrigger>
					</TabsList>
				</Tabs>

				{tab === "existing" && (
					<div className="flex flex-col gap-2">
						<div className="relative">
							<IconSearch
								className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
								size={16}
							/>
							<Input
								aria-label="Search players"
								className="pl-9"
								id="add-player-search"
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Search players..."
								value={search}
							/>
						</div>

						<div className="max-h-[40vh] overflow-y-auto">
							{filteredPlayers.length === 0 && (
								<EmptyState
									className="border-none bg-transparent px-0 py-4"
									description={search ? "Try a different name." : undefined}
									heading={
										search ? "No matching players" : "No available players"
									}
								/>
							)}
							{filteredPlayers.map((p) => (
								<Button
									className="h-auto w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-left"
									key={p.id}
									onClick={() => handleAddExisting(p.id, p.name)}
									type="button"
									variant="ghost"
								>
									<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-xs">
										{p.name.slice(0, 2).toUpperCase()}
									</div>
									<div className="min-w-0 flex-1">
										<p className="truncate font-medium text-sm">{p.name}</p>
										{p.memo && (
											<p className="truncate text-muted-foreground text-xs">
												{p.memo}
											</p>
										)}
									</div>
									<IconPlus
										className="shrink-0 text-muted-foreground"
										size={16}
									/>
								</Button>
							))}
						</div>
					</div>
				)}

				{tab === "new" && (
					<PlayerForm
						key={String(open)}
						availableTags={availableTags}
						leadingActions={
							<Button
								onClick={() => onOpenChange(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
						}
						onCreateTag={onCreateTag}
						onSubmit={handleAddNew}
					/>
				)}
			</div>
		</ResponsiveDialog>
	);
}
