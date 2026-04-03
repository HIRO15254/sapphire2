import { IconPlus, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/utils/trpc";

interface AddPlayerSheetProps {
	excludePlayerIds: string[];
	onAddExisting: (playerId: string, playerName: string) => void;
	onAddNew: (name: string, memo?: string) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function AddPlayerSheet({
	excludePlayerIds,
	onAddExisting,
	onAddNew,
	onOpenChange,
	open,
}: AddPlayerSheetProps) {
	const [tab, setTab] = useState<"existing" | "new">("existing");
	const [search, setSearch] = useState("");
	const [newName, setNewName] = useState("");
	const [newMemo, setNewMemo] = useState("");

	useEffect(() => {
		if (open) {
			setTab("existing");
			setSearch("");
			setNewName("");
			setNewMemo("");
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

	const handleAddNew = (e: React.FormEvent) => {
		e.preventDefault();
		if (!newName.trim()) {
			return;
		}
		onAddNew(newName.trim(), newMemo.trim() || undefined);
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
						{/* Search input */}
						<div className="relative">
							<IconSearch
								className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
								size={16}
							/>
							<Input
								className="pl-9"
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Search players..."
								value={search}
							/>
						</div>

						{/* Player list */}
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
								<button
									className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
									key={p.id}
									onClick={() => handleAddExisting(p.id, p.name)}
									type="button"
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
								</button>
							))}
						</div>
					</div>
				)}

				{tab === "new" && (
					<form className="flex flex-col gap-4" onSubmit={handleAddNew}>
						<Field htmlFor="new-player-name" label="Name">
							<Input
								id="new-player-name"
								onChange={(e) => setNewName(e.target.value)}
								placeholder="Player name"
								required
								value={newName}
							/>
						</Field>
						<Field htmlFor="new-player-memo" label="Memo (optional)">
							<Input
								id="new-player-memo"
								onChange={(e) => setNewMemo(e.target.value)}
								placeholder="Notes about this player"
								value={newMemo}
							/>
						</Field>
						<Button type="submit">Add Player</Button>
					</form>
				)}
			</div>
		</ResponsiveDialog>
	);
}
