import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Field } from "@/shared/components/ui/field";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { TournamentEditDialog } from "@/stores/components/tournament-edit-dialog";
import type { BlindLevelRow } from "@/stores/hooks/use-blind-levels";
import type { TournamentFormValues } from "@/stores/hooks/use-tournaments";
import { trpc, trpcClient } from "@/utils/trpc";

interface AssignTournamentDialogProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	sessionId: string;
	sessionStoreId: string | null;
}

type Mode = "existing" | "create";

interface TournamentListItem {
	id: string;
	name: string;
}

function levelsToPayload(levels: BlindLevelRow[]) {
	return levels.map((l) => ({
		isBreak: l.isBreak,
		blind1: l.blind1,
		blind2: l.blind2,
		blind3: l.blind3,
		ante: l.ante,
		minutes: l.minutes,
	}));
}

function StoreSelectField({
	onChange,
	stores,
	value,
}: {
	onChange: (value: string) => void;
	stores: { id: string; name: string }[];
	value: string | undefined;
}) {
	if (stores.length === 0) {
		return (
			<Field className="mb-4" label="Store" required>
				<EmptyState
					className="px-4 py-8"
					description="Create a store first."
					heading="No stores available"
				/>
			</Field>
		);
	}
	return (
		<Field className="mb-4" label="Store" required>
			<Select onValueChange={onChange} value={value}>
				<SelectTrigger>
					<SelectValue placeholder="Select a store" />
				</SelectTrigger>
				<SelectContent>
					{stores.map((s) => (
						<SelectItem key={s.id} value={s.id}>
							{s.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);
}

function TournamentPickerField({
	effectiveStoreId,
	onChange,
	tournaments,
	value,
}: {
	effectiveStoreId: string | undefined;
	onChange: (value: string) => void;
	tournaments: TournamentListItem[];
	value: string | undefined;
}) {
	if (!effectiveStoreId) {
		return (
			<Field label="Tournament" required>
				<p className="text-muted-foreground text-sm">
					Please select a store first.
				</p>
			</Field>
		);
	}
	if (tournaments.length === 0) {
		return (
			<Field label="Tournament" required>
				<EmptyState
					className="px-4 py-8"
					description="Use the Create new tab to add one."
					heading="No tournaments"
				/>
			</Field>
		);
	}
	return (
		<Field label="Tournament" required>
			<Select onValueChange={onChange} value={value}>
				<SelectTrigger>
					<SelectValue placeholder="Select a tournament" />
				</SelectTrigger>
				<SelectContent>
					{tournaments.map((t) => (
						<SelectItem key={t.id} value={t.id}>
							{t.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);
}

export function AssignTournamentDialog({
	onOpenChange,
	open,
	sessionId,
	sessionStoreId,
}: AssignTournamentDialogProps) {
	const [mode, setMode] = useState<Mode>("existing");
	const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(
		sessionStoreId ?? undefined
	);
	const [selectedTournamentId, setSelectedTournamentId] = useState<
		string | undefined
	>(undefined);
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const queryClient = useQueryClient();

	const storesQuery = useQuery({
		...trpc.store.list.queryOptions(),
		enabled: open,
	});
	const stores = storesQuery.data ?? [];

	const effectiveStoreId = sessionStoreId ?? selectedStoreId;

	const tournamentsQuery = useQuery({
		...trpc.tournament.listByStore.queryOptions({
			storeId: effectiveStoreId ?? "",
			includeArchived: false,
		}),
		enabled: open && !!effectiveStoreId,
	});
	const tournaments = (tournamentsQuery.data ?? []) as TournamentListItem[];

	const invalidateSession = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: trpc.liveTournamentSession.getById.queryOptions({
					id: sessionId,
				}).queryKey,
			}),
			queryClient.invalidateQueries({
				queryKey: trpc.liveTournamentSession.list.queryOptions({}).queryKey,
			}),
			queryClient.invalidateQueries({
				queryKey: trpc.session.list.queryOptions({}).queryKey,
			}),
		]);
	};

	const assignMutation = useMutation({
		mutationFn: (tournamentId: string) =>
			trpcClient.liveTournamentSession.update.mutate({
				id: sessionId,
				tournamentId,
			}),
		onSuccess: async () => {
			await invalidateSession();
			toast.success("Tournament assigned");
			onOpenChange(false);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to assign tournament");
		},
	});

	const createAndAssignMutation = useMutation({
		mutationFn: async ({
			storeId,
			values,
			levels,
		}: {
			storeId: string;
			values: TournamentFormValues;
			levels: BlindLevelRow[];
		}) => {
			const created = await trpcClient.tournament.createWithLevels.mutate({
				storeId,
				name: values.name,
				variant: values.variant,
				buyIn: values.buyIn,
				entryFee: values.entryFee,
				startingStack: values.startingStack,
				bountyAmount: values.bountyAmount,
				tableSize: values.tableSize,
				currencyId: values.currencyId,
				memo: values.memo,
				tags: values.tags,
				chipPurchases: values.chipPurchases,
				blindLevels: levelsToPayload(levels),
			});
			await trpcClient.liveTournamentSession.update.mutate({
				id: sessionId,
				tournamentId: created.id,
			});
			return created;
		},
		onSuccess: async () => {
			await Promise.all([
				invalidateSession(),
				queryClient.invalidateQueries({
					queryKey: trpc.tournament.listByStore.queryOptions({
						storeId: effectiveStoreId ?? "",
						includeArchived: false,
					}).queryKey,
				}),
			]);
			toast.success("Tournament created and assigned");
			setIsCreateDialogOpen(false);
			onOpenChange(false);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create tournament");
		},
	});

	const isAssignPending = assignMutation.isPending;
	const isCreatePending = createAndAssignMutation.isPending;
	const isBusy = isAssignPending || isCreatePending;

	const handleAssign = () => {
		if (!selectedTournamentId) {
			return;
		}
		assignMutation.mutate(selectedTournamentId);
	};

	const handleCreate = async (
		values: TournamentFormValues,
		levels: BlindLevelRow[]
	) => {
		if (!effectiveStoreId) {
			toast.error("Select a store first");
			return;
		}
		await createAndAssignMutation.mutateAsync({
			storeId: effectiveStoreId,
			values,
			levels,
		});
	};

	const renderExistingTab = () => (
		<div className="flex flex-col gap-4">
			<TournamentPickerField
				effectiveStoreId={effectiveStoreId}
				onChange={(value) => setSelectedTournamentId(value)}
				tournaments={tournaments}
				value={selectedTournamentId}
			/>
			<Button
				disabled={isBusy || !(effectiveStoreId && selectedTournamentId)}
				onClick={handleAssign}
				type="button"
			>
				{isAssignPending ? "Assigning..." : "Assign"}
			</Button>
		</div>
	);

	const renderCreateTab = () => {
		if (!effectiveStoreId) {
			return (
				<p className="text-muted-foreground text-sm">
					Please select a store first.
				</p>
			);
		}
		return (
			<div className="flex flex-col gap-4">
				<Button
					disabled={isBusy}
					onClick={() => setIsCreateDialogOpen(true)}
					type="button"
				>
					Create new tournament
				</Button>
			</div>
		);
	};

	return (
		<>
			<ResponsiveDialog
				onOpenChange={(o) => {
					if (!isBusy) {
						onOpenChange(o);
					}
				}}
				open={open}
				title="Assign Tournament"
			>
				<Tabs
					className="mb-4"
					onValueChange={(value) => setMode(value as Mode)}
					value={mode}
				>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="existing">Select existing</TabsTrigger>
						<TabsTrigger value="create">Create new</TabsTrigger>
					</TabsList>
				</Tabs>

				{sessionStoreId ? null : (
					<StoreSelectField
						onChange={(value) => {
							setSelectedStoreId(value);
							setSelectedTournamentId(undefined);
						}}
						stores={stores}
						value={selectedStoreId}
					/>
				)}

				{mode === "existing" ? renderExistingTab() : renderCreateTab()}
			</ResponsiveDialog>

			<TournamentEditDialog
				aiMode="create"
				initialBlindLevels={[]}
				isLoading={isCreatePending}
				onOpenChange={setIsCreateDialogOpen}
				onSave={handleCreate}
				open={isCreateDialogOpen}
				title="New Tournament"
			/>
		</>
	);
}
