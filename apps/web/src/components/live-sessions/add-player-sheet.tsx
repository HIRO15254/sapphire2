import { IconPlus, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
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
				{/* Tab selector */}
				<div className="flex gap-1 rounded-lg bg-muted p-1">
					<button
						className={cn(
							"flex-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors",
							tab === "existing"
								? "bg-background shadow-sm"
								: "text-muted-foreground hover:text-foreground"
						)}
						onClick={() => setTab("existing")}
						type="button"
					>
						Existing
					</button>
					<button
						className={cn(
							"flex-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors",
							tab === "new"
								? "bg-background shadow-sm"
								: "text-muted-foreground hover:text-foreground"
						)}
						onClick={() => setTab("new")}
						type="button"
					>
						New Player
					</button>
				</div>

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
								<p className="py-4 text-center text-muted-foreground text-sm">
									{search ? "No matching players" : "No available players"}
								</p>
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
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="new-player-name">Name</Label>
							<Input
								id="new-player-name"
								onChange={(e) => setNewName(e.target.value)}
								placeholder="Player name"
								required
								value={newName}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="new-player-memo">Memo (optional)</Label>
							<Input
								id="new-player-memo"
								onChange={(e) => setNewMemo(e.target.value)}
								placeholder="Notes about this player"
								value={newMemo}
							/>
						</div>
						<Button type="submit">Add Player</Button>
					</form>
				)}
			</div>
		</ResponsiveDialog>
	);
}
