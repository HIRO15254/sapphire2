import { useState } from "react";
import { AddonBottomSheet } from "@/components/live-sessions/addon-bottom-sheet";
import { AllInBottomSheet } from "@/components/live-sessions/all-in-bottom-sheet";
import { EventBadge } from "@/components/live-sessions/event-badge";
import {
	StackBadgeRow,
	StackNumberField,
	StackPrimaryRow,
	StackQuickActions,
} from "@/components/live-sessions/stack-ui";
import { Button } from "@/components/ui/button";
import { useStackFormContext } from "@/hooks/use-session-form";

interface CashGameStackFormProps {
	isLoading: boolean;
	onChipAdd: (amount: number) => void;
	onComplete: (currentStack: number) => void;
	onSubmit: (values: {
		allIns: Array<{
			potSize: number;
			trials: number;
			equity: number;
			wins: number;
		}>;
		stackAmount: number;
	}) => void;
}

export function CashGameStackForm({
	isLoading,
	onChipAdd,
	onComplete,
	onSubmit,
}: CashGameStackFormProps) {
	const { state, setStackAmount, setAllIns } = useStackFormContext();
	const { stackAmount, allIns } = state;

	const [allInBottomSheetOpen, setAllInBottomSheetOpen] = useState(false);
	const [editingAllIn, setEditingAllIn] = useState<
		(typeof allIns)[number] | null
	>(null);
	const [addonBottomSheetOpen, setAddonBottomSheetOpen] = useState(false);

	let nextId = allIns.length > 0 ? Math.max(...allIns.map((a) => a.id)) : 0;

	const handleAddAllInClick = () => {
		setEditingAllIn(null);
		setAllInBottomSheetOpen(true);
	};

	const handleAllInBadgeClick = (allIn: (typeof allIns)[number]) => {
		setEditingAllIn(allIn);
		setAllInBottomSheetOpen(true);
	};

	const handleAllInSubmit = (values: {
		potSize: number;
		trials: number;
		equity: number;
		wins: number;
	}) => {
		if (editingAllIn === null) {
			nextId += 1;
			setAllIns((prev) => [...prev, { ...values, id: nextId }]);
		} else {
			setAllIns((prev) =>
				prev.map((item) =>
					item.id === editingAllIn.id ? { ...values, id: item.id } : item
				)
			);
		}
		setAllInBottomSheetOpen(false);
		setEditingAllIn(null);
	};

	const handleAllInDelete = () => {
		if (editingAllIn !== null) {
			setAllIns((prev) => prev.filter((item) => item.id !== editingAllIn.id));
		}
		setAllInBottomSheetOpen(false);
		setEditingAllIn(null);
	};

	const handleAddonSubmit = (values: { amount: number }) => {
		onChipAdd(values.amount);
		// Auto-increment stack by addon amount
		const currentStack = Number(stackAmount) || 0;
		setStackAmount(String(currentStack + values.amount));
		setAddonBottomSheetOpen(false);
	};

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		onSubmit({
			stackAmount: Number(stackAmount),
			allIns: allIns.map(({ potSize, trials, equity, wins }) => ({
				potSize,
				trials,
				equity,
				wins,
			})),
		});

		// Reset allIns after submit, but keep stackAmount
		setAllIns([]);
	};

	const handleComplete = () => {
		onComplete(Number(stackAmount) || 0);
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			{allIns.length > 0 && (
				<StackBadgeRow>
					{allIns.map((allIn) => (
						<EventBadge
							data={{
								potSize: allIn.potSize,
								trials: allIn.trials,
								equity: allIn.equity,
								wins: allIn.wins,
							}}
							key={allIn.id}
							onEdit={() => handleAllInBadgeClick(allIn)}
							type="all-in"
						/>
					))}
				</StackBadgeRow>
			)}

			<StackPrimaryRow>
				<StackNumberField
					className="sm:min-w-[12rem]"
					id="cash-stack-amount"
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
					onClick={handleComplete}
					size="sm"
					type="button"
					variant="outline"
				>
					End
				</Button>
			</StackPrimaryRow>

			<StackQuickActions>
				<Button
					onClick={handleAddAllInClick}
					size="xs"
					type="button"
					variant="ghost"
				>
					+ All-in
				</Button>
				<Button
					onClick={() => setAddonBottomSheetOpen(true)}
					size="xs"
					type="button"
					variant="ghost"
				>
					+ Addon
				</Button>
			</StackQuickActions>

			<AllInBottomSheet
				initialValues={editingAllIn ?? undefined}
				onDelete={editingAllIn !== null ? handleAllInDelete : undefined}
				onOpenChange={setAllInBottomSheetOpen}
				onSubmit={handleAllInSubmit}
				open={allInBottomSheetOpen}
			/>

			<AddonBottomSheet
				onOpenChange={setAddonBottomSheetOpen}
				onSubmit={handleAddonSubmit}
				open={addonBottomSheetOpen}
			/>
		</form>
	);
}
