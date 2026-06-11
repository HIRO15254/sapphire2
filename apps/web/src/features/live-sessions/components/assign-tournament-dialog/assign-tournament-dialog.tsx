import { TournamentFormSheet } from "@/features/rooms/components/tournament-form-sheet";
import { Button } from "@/shared/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Field } from "@/shared/components/ui/field";
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

const CREATE_TOURNAMENT_FORM_ID = "assign-tournament-create-form";

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
			<Drawer
				onOpenChange={(o) => {
					if (!isBusy) {
						onOpenChange(o);
					}
				}}
				open={open}
			>
				<DrawerContent className="rounded-t-xl">
					<div
						aria-hidden
						className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
					/>
					<DrawerTitle className="t-h4 px-4 pt-1">
						Assign Tournament
					</DrawerTitle>
					<DrawerDescription className="sr-only">
						Select an existing tournament or create a new one for this session.
					</DrawerDescription>
					<div className="overflow-y-auto px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
					</div>
				</DrawerContent>
			</Drawer>

			<TournamentFormSheet
				aiMode="create"
				formId={CREATE_TOURNAMENT_FORM_ID}
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
