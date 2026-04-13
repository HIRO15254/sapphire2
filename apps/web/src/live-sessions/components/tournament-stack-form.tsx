import {
	StackNumberField,
	StackPrimaryRow,
	StackQuickActions,
} from "@/live-sessions/components/stack-ui";
import { useTournamentFormContext } from "@/live-sessions/hooks/use-session-form";
import { Button } from "@/shared/components/ui/button";

interface ChipPurchaseType {
	chips: number;
	cost: number;
	name: string;
}

interface TournamentStackFormProps {
	chipPurchaseTypes?: ChipPurchaseType[];
	isLoading: boolean;
	onComplete: () => void;
	onMemo: (text: string) => void;
	onPause: () => void;
	onPurchaseChips: (values: {
		name: string;
		cost: number;
		chips: number;
	}) => void;
	onSubmit: (values: { stackAmount: number }) => void;
}

function buildChipPurchaseButtons(
	chipPurchaseTypes: ChipPurchaseType[],
	onAdd: (type: ChipPurchaseType) => void
) {
	if (chipPurchaseTypes.length === 0) {
		return null;
	}
	return chipPurchaseTypes.map((t) => (
		<Button
			key={t.name}
			onClick={() => onAdd(t)}
			size="xs"
			type="button"
			variant="ghost"
		>
			+ {t.name}
		</Button>
	));
}

export function TournamentStackForm({
	chipPurchaseTypes = [],
	isLoading,
	onComplete,
	onMemo,
	onPause,
	onPurchaseChips,
	onSubmit,
}: TournamentStackFormProps) {
	const { state, setStackAmount } = useTournamentFormContext();
	const { stackAmount } = state;

	const handleInstantAdd = (type: ChipPurchaseType) => {
		onPurchaseChips({ name: type.name, cost: type.cost, chips: type.chips });
		// Auto-increment stack display by chips received
		const currentStack = Number(stackAmount) || 0;
		setStackAmount(String(currentStack + type.chips));
	};

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		onSubmit({ stackAmount: Number(stackAmount) });
	};

	return (
		<div className="flex flex-col gap-2">
			<form className="flex flex-col gap-2" onSubmit={handleSubmit}>
				<StackPrimaryRow>
					<StackNumberField
						className="sm:min-w-[12rem]"
						id="tournament-stack-amount"
						inputMode="numeric"
						label="Current Stack"
						min={0}
						onChange={setStackAmount}
						required
						type="number"
						value={stackAmount}
					/>
					<Button disabled={isLoading} size="sm" type="submit">
						{isLoading ? "..." : "Update"}
					</Button>
					<Button
						onClick={onComplete}
						size="sm"
						type="button"
						variant="outline"
					>
						End
					</Button>
				</StackPrimaryRow>
			</form>

			<StackQuickActions>
				{buildChipPurchaseButtons(chipPurchaseTypes, handleInstantAdd)}
				<Button
					onClick={() => onMemo("")}
					size="xs"
					type="button"
					variant="ghost"
				>
					+ Memo
				</Button>
				<Button onClick={onPause} size="xs" type="button" variant="ghost">
					Pause
				</Button>
			</StackQuickActions>
		</div>
	);
}
