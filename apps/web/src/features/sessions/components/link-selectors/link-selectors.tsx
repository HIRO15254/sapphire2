import { Field } from "@/shared/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SelectWithClear,
} from "@/shared/components/ui/select";

interface StoreGameSelectorProps {
	gameLabel: string;
	gameOptions?: Array<{ id: string; name: string }>;
	isLiveLinked?: boolean;
	onGameChange: (value: string | undefined) => void;
	onStoreChange: (value: string | undefined) => void;
	selectedGameId: string | undefined;
	selectedStoreId: string | undefined;
	stores?: Array<{ id: string; name: string }>;
}

export function StoreGameSelectors({
	gameLabel,
	gameOptions,
	isLiveLinked = false,
	onGameChange,
	onStoreChange,
	selectedGameId,
	selectedStoreId,
	stores,
}: StoreGameSelectorProps) {
	if (!stores || stores.length === 0) {
		return null;
	}

	const hasGameOptions =
		selectedStoreId && gameOptions && gameOptions.length > 0;

	return (
		<>
			<Field label="Store">
				<SelectWithClear onValueChange={onStoreChange} value={selectedStoreId}>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{stores.map((s) => (
							<SelectItem key={s.id} value={s.id}>
								{s.name}
							</SelectItem>
						))}
					</SelectContent>
				</SelectWithClear>
			</Field>

			{selectedStoreId && (
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
