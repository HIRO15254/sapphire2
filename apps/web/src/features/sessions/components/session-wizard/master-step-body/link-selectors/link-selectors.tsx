import { Field } from "@/shared/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SelectWithClear,
} from "@/shared/components/ui/select";

interface RoomGameSelectorProps {
	gameLabel: string;
	gameOptions?: Array<{ id: string; name: string }>;
	isLiveLinked?: boolean;
	onGameChange: (value: string | undefined) => void;
	onRoomChange: (value: string | undefined) => void;
	rooms?: Array<{ id: string; name: string }>;
	selectedGameId: string | undefined;
	selectedRoomId: string | undefined;
}

export function RoomGameSelectors({
	gameLabel,
	gameOptions,
	isLiveLinked = false,
	onGameChange,
	onRoomChange,
	selectedGameId,
	selectedRoomId,
	rooms,
}: RoomGameSelectorProps) {
	if (!rooms || rooms.length === 0) {
		return null;
	}

	const hasGameOptions =
		selectedRoomId && gameOptions && gameOptions.length > 0;

	return (
		<>
			<Field label="Room">
				<SelectWithClear onValueChange={onRoomChange} value={selectedRoomId}>
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
				</SelectWithClear>
			</Field>

			{selectedRoomId && (
				<Field label={gameLabel}>
					{hasGameOptions ? (
						<SelectWithClear
							disabled={isLiveLinked}
							onValueChange={onGameChange}
							value={selectedGameId}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{gameOptions.map((g) => (
									<SelectItem key={g.id} value={g.id}>
										{g.name}
									</SelectItem>
								))}
							</SelectContent>
						</SelectWithClear>
					) : (
						<Select disabled>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
						</Select>
					)}
				</Field>
			)}
		</>
	);
}
