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

function GameSelector({
	gameLabel,
	gameOptions,
	onGameChange,
	selectedGameId,
	selectedStoreId,
}: Omit<StoreGameSelectorProps, "onStoreChange" | "stores">) {
	if (selectedStoreId && gameOptions && gameOptions.length > 0) {
		return (
			<Select onValueChange={onGameChange} value={selectedGameId ?? NONE_VALUE}>
				<SelectTrigger>
					<SelectValue placeholder={`Select a ${gameLabel.toLowerCase()}`} />
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
		);
	}

	return (
		<Select disabled>
			<SelectTrigger>
				<SelectValue placeholder="Select a store first" />
			</SelectTrigger>
		</Select>
	);
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

	return (
		<div className="grid grid-cols-2 gap-3">
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
			<div className="flex flex-col gap-2">
				<Label>{gameLabel}</Label>
				<GameSelector
					gameLabel={gameLabel}
					gameOptions={gameOptions}
					onGameChange={onGameChange}
					selectedGameId={selectedGameId}
					selectedStoreId={selectedStoreId}
				/>
			</div>
		</div>
	);
}
