import { TournamentFormSheet } from "@/features/rooms/components/tournament-form-sheet";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/shared/components/bottom-sheet";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Field } from "@/shared/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import {
	type AssignTournamentMode,
	type TournamentListItem,
	useAssignTournament,
} from "./use-assign-tournament";

const CREATE_TOURNAMENT_FORM_ID = "assign-tournament-create-form";

interface AssignTournamentDialogProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	sessionId: string;
	sessionRoomId: string | null;
}

const TAB_BUTTON_CLASS = "h-[34px] flex-1 rounded-[var(--radius-md)] text-sm";
const TAB_ACTIVE_CLASS = "bg-card font-semibold text-foreground";
const TAB_INACTIVE_CLASS = "font-medium text-muted-foreground";

function ModeTabs({
	mode,
	onChange,
}: {
	mode: AssignTournamentMode;
	onChange: (mode: AssignTournamentMode) => void;
}) {
	return (
		<div className="mb-4 flex gap-0.5 rounded-[var(--radius-lg)] bg-muted p-[3px]">
			<button
				aria-pressed={mode === "existing"}
				className={cn(
					TAB_BUTTON_CLASS,
					mode === "existing" ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS
				)}
				onClick={() => onChange("existing")}
				type="button"
			>
				Select existing
			</button>
			<button
				aria-pressed={mode === "create"}
				className={cn(
					TAB_BUTTON_CLASS,
					mode === "create" ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS
				)}
				onClick={() => onChange("create")}
				type="button"
			>
				Create new
			</button>
		</div>
	);
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

	const handleOpenChange = (nextOpen: boolean) => {
		if (!isBusy) {
			onOpenChange(nextOpen);
		}
	};

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
			<BottomSheet
				cancelLabel="Cancel"
				description="Select an existing tournament or create a new one for this session."
				onOpenChange={handleOpenChange}
				open={open}
				title="Assign Tournament"
			>
				<ModeTabs mode={mode} onChange={setMode} />

				{sessionRoomId ? null : (
					<RoomSelectField
						onChange={handleRoomChange}
						rooms={rooms}
						value={selectedRoomId}
					/>
				)}

				{mode === "existing" ? renderExistingTab() : renderCreateTab()}
			</BottomSheet>

			<TournamentFormSheet
				aiMode="create"
				formId={CREATE_TOURNAMENT_FORM_ID}
				initialBlindLevels={[]}
				isLoading={isCreatePending}
				onOpenChange={setIsCreateDialogOpen}
				onSave={handleCreate}
				open={isCreateDialogOpen}
				sheetVariant="cryst"
				title="New Tournament"
			/>
		</>
	);
}
