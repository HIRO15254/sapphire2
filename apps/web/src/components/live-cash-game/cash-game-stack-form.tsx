import { useState } from "react";
import { AddonBottomSheet } from "@/components/live-sessions/addon-bottom-sheet";
import { AllInBottomSheet } from "@/components/live-sessions/all-in-bottom-sheet";
import { EventBadge } from "@/components/live-sessions/event-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStackFormContext } from "@/routes/live-sessions/cash-game/$sessionId";

interface CashGameStackFormProps {
	isLoading: boolean;
	onComplete: (currentStack: number) => void;
	onSubmit: (values: {
		addon: { amount: number } | null;
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
	onComplete,
	onSubmit,
}: CashGameStackFormProps) {
	const { state, setStackAmount, setAllIns, setAddon } = useStackFormContext();
	const { stackAmount, allIns, addon } = state;

	const [allInBottomSheetOpen, setAllInBottomSheetOpen] = useState(false);
	const [editingAllIn, setEditingAllIn] = useState<
		(typeof allIns)[number] | null
	>(null);
	const [addonBottomSheetOpen, setAddonBottomSheetOpen] = useState(false);
	const [editingAddon, setEditingAddon] = useState(false);

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

	const handleAddAddonClick = () => {
		setEditingAddon(false);
		setAddonBottomSheetOpen(true);
	};

	const handleAddonBadgeClick = () => {
		setEditingAddon(true);
		setAddonBottomSheetOpen(true);
	};

	const handleAddonSubmit = (values: { amount: number }) => {
		setAddon(values);
		setAddonBottomSheetOpen(false);
		setEditingAddon(false);
	};

	const handleAddonDelete = () => {
		setAddon(null);
		setAddonBottomSheetOpen(false);
		setEditingAddon(false);
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
			addon,
		});

		// Reset allIns and addon after submit, but keep stackAmount
		setAllIns([]);
		setAddon(null);
	};

	const handleComplete = () => {
		onComplete(Number(stackAmount) || 0);
	};

	return (
		<div className="flex flex-col gap-2">
			{/* Row 1: Event badges */}
			{(allIns.length > 0 || addon !== null) && (
				<div className="flex gap-1.5 overflow-x-auto pb-1">
					{allIns.map((allIn) => (
						<EventBadge
							data={{
								potSize: allIn.potSize,
								trials: allIn.trials,
								equity: allIn.equity,
								wins: allIn.wins,
							}}
							key={allIn.id}
							onDelete={() => {
								setAllIns((prev) =>
									prev.filter((item) => item.id !== allIn.id)
								);
							}}
							onEdit={() => handleAllInBadgeClick(allIn)}
							type="all-in"
						/>
					))}
					{addon && (
						<EventBadge
							data={{ amount: addon.amount }}
							onDelete={handleAddonDelete}
							onEdit={handleAddonBadgeClick}
							type="addon"
						/>
					)}
				</div>
			)}

			{/* Row 2: Stack input + Update + End */}
			<form className="flex items-center gap-2" onSubmit={handleSubmit}>
				<Input
					className="flex-1"
					inputMode="numeric"
					min={0}
					onChange={(e) => setStackAmount(e.target.value)}
					placeholder="Stack"
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
			</form>

			{/* Row 3: +All-in +Addon buttons */}
			<div className="flex gap-2">
				<Button
					onClick={handleAddAllInClick}
					size="xs"
					type="button"
					variant="ghost"
				>
					+ All-in
				</Button>
				<Button
					onClick={handleAddAddonClick}
					size="xs"
					type="button"
					variant="ghost"
				>
					+ Addon
				</Button>
			</div>

			{/* Bottom sheets */}
			<AllInBottomSheet
				initialValues={editingAllIn ?? undefined}
				onDelete={editingAllIn !== null ? handleAllInDelete : undefined}
				onOpenChange={setAllInBottomSheetOpen}
				onSubmit={handleAllInSubmit}
				open={allInBottomSheetOpen}
			/>

			<AddonBottomSheet
				initialAmount={editingAddon && addon ? addon.amount : undefined}
				onDelete={editingAddon ? handleAddonDelete : undefined}
				onOpenChange={setAddonBottomSheetOpen}
				onSubmit={handleAddonSubmit}
				open={addonBottomSheetOpen}
			/>
		</div>
	);
}
