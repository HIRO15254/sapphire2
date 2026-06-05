import { TournamentEditDialog } from "@/features/rooms/components/tournament-edit-dialog";
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
import {
	type AssignTournamentMode,
	type TournamentListItem,
	useAssignTournament,
} from "./use-assign-tournament";

interface AssignTournamentDialogProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	sessionId: string;
	sessionRoomId: string | null;
}

function RoomSelectField({
	onChange,
	rooms,
	value,
}: {
	onChange: (value: string) => void;
	rooms: { id: string; name: string }[];
	value: string | undefined;
}) {
	if (rooms.length === 0) {
		return (
			<Field className="mb-4" label="Room" required>
				<EmptyState
					className="px-4 py-8"
					description="Create a room first."
					heading="No rooms available"
				/>
			</Field>
		);
	}
	return (
		<Field className="mb-4" label="Room" required>
			<Select onValueChange={onChange} value={value}>
				<SelectTrigger>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{rooms.map((s) => (
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
	effectiveRoomId,
	onChange,
	tournaments,
	value,
}: {
	effectiveRoomId: string | undefined;
	onChange: (value: string) => void;
	tournaments: TournamentListItem[];
	value: string | undefined;
}) {
	if (!effectiveRoomId) {
		return (
			<Field label="Tournament" required>
				<p className="text-muted-foreground text-sm">
					Please select a room first.
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
					<SelectValue />
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
	sessionRoomId,
}: AssignTournamentDialogProps) {
	const {
		mode,
		setMode,
		selectedRoomId,
		selectedTournamentId,
		setSelectedTournamentId,
		isCreateDialogOpen,
		setIsCreateDialogOpen,
		rooms,
		tournaments,
		effectiveRoomId,
		isAssignPending,
		isCreatePending,
		isBusy,
		handleRoomChange,
		handleAssign,
		handleCreate,
	} = useAssignTournament({
		onOpenChange,
		open,
		sessionId,
		sessionRoomId,
	});

	const renderExistingTab = () => (
		<div className="flex flex-col gap-4">
			<TournamentPickerField
				effectiveRoomId={effectiveRoomId}
				onChange={(value) => setSelectedTournamentId(value)}
				tournaments={tournaments}
				value={selectedTournamentId}
			/>
			<Button
				disabled={isBusy || !(effectiveRoomId && selectedTournamentId)}
				onClick={handleAssign}
				type="button"
			>
				{isAssignPending ? "Assigning..." : "Assign"}
			</Button>
		</div>
	);

	const renderCreateTab = () => {
		if (!effectiveRoomId) {
			return (
				<p className="text-muted-foreground text-sm">
					Please select a room first.
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

				{sessionRoomId ? null : (
					<RoomSelectField
						onChange={handleRoomChange}
						rooms={rooms}
						value={selectedRoomId}
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
