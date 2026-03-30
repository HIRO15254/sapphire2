import { useState } from "react";
import { AddonBottomSheet } from "@/components/live-sessions/addon-bottom-sheet";
import { AllInBottomSheet } from "@/components/live-sessions/all-in-bottom-sheet";
import { EventBadge } from "@/components/live-sessions/event-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AllIn {
	equity: number;
	id: number;
	potSize: number;
	trials: number;
	wins: number;
}

interface CashGameStackFormProps {
	isLoading: boolean;
	onComplete: () => void;
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

let nextId = 0;

export function CashGameStackForm({
	isLoading,
	onComplete,
	onSubmit,
}: CashGameStackFormProps) {
	const [stackAmount, setStackAmount] = useState<string>("");
	const [allIns, setAllIns] = useState<AllIn[]>([]);
	const [addon, setAddon] = useState<{ amount: number } | null>(null);
	const [allInBottomSheetOpen, setAllInBottomSheetOpen] = useState(false);
	const [editingAllIn, setEditingAllIn] = useState<AllIn | null>(null);
	const [addonBottomSheetOpen, setAddonBottomSheetOpen] = useState(false);
	const [editingAddon, setEditingAddon] = useState(false);

	const handleAddAllInClick = () => {
		setEditingAllIn(null);
		setAllInBottomSheetOpen(true);
	};

	const handleAllInBadgeClick = (allIn: AllIn) => {
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
				<Button onClick={onComplete} size="sm" type="button" variant="outline">
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
