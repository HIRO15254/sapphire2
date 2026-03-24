import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const NONE_VALUE = "__none__";

interface StoreGameSelectorProps {
	gameLabel: string;
	gameOptions?: Array<{ id: string; name: string }>;
	onGameChange: (value: string) => void;
	onStoreChange: (value: string) => void;
	selectedGameId: string | undefined;
	selectedStoreId: string | undefined;
	stores?: Array<{ id: string; name: string }>;
}

export function StoreGameSelectors({
	gameLabel,
	gameOptions,
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
			<div className="flex flex-col gap-2">
				<Label>Store</Label>
				<Select
					onValueChange={onStoreChange}
					value={selectedStoreId ?? NONE_VALUE}
				>
					<SelectTrigger>
						<SelectValue placeholder="Select a store" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={NONE_VALUE}>None</SelectItem>
						{stores.map((s) => (
							<SelectItem key={s.id} value={s.id}>
								{s.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{selectedStoreId && (
				<div className="flex flex-col gap-2">
					<Label>{gameLabel}</Label>
					{hasGameOptions ? (
						<Select
							onValueChange={onGameChange}
							value={selectedGameId ?? NONE_VALUE}
						>
							<SelectTrigger>
								<SelectValue
									placeholder={`Select a ${gameLabel.toLowerCase()}`}
								/>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE_VALUE}>None</SelectItem>
								{gameOptions.map((g) => (
									<SelectItem key={g.id} value={g.id}>
										{g.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : (
						<Select disabled>
							<SelectTrigger>
								<SelectValue placeholder="No games available" />
							</SelectTrigger>
						</Select>
					)}
				</div>
			)}
		</>
	);
}
