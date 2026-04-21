import {
	type AssignTournamentMode,
	type TournamentListItem,
	useAssignTournament,
} from "@/live-sessions/hooks/use-assign-tournament";
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

interface AssignTournamentDialogProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	sessionId: string;
	sessionStoreId: string | null;
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
	const {
		mode,
		setMode,
		selectedStoreId,
		selectedTournamentId,
		setSelectedTournamentId,
		isCreateDialogOpen,
		setIsCreateDialogOpen,
		stores,
		tournaments,
		effectiveStoreId,
		isAssignPending,
		isCreatePending,
		isBusy,
		handleStoreChange,
		handleAssign,
		handleCreate,
	} = useAssignTournament({
		onOpenChange,
		open,
		sessionId,
		sessionStoreId,
	});

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
					onValueChange={(value) => setMode(value as AssignTournamentMode)}
					value={mode}
				>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="existing">Select existing</TabsTrigger>
						<TabsTrigger value="create">Create new</TabsTrigger>
					</TabsList>
				</Tabs>

				{sessionStoreId ? null : (
					<StoreSelectField
						onChange={handleStoreChange}
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
