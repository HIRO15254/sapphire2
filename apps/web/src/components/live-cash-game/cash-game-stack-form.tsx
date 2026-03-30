import { useState } from "react";
import { AddonBottomSheet } from "@/components/live-sessions/addon-bottom-sheet";
import { AllInBottomSheet } from "@/components/live-sessions/all-in-bottom-sheet";
import { EventBadge } from "@/components/live-sessions/event-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AllIn {
	equity: number;
	id: number;
	potSize: number;
	trials: number;
	wins: number;
}

interface CashGameStackFormProps {
	isLoading: boolean;
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
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<div className="flex flex-col gap-2">
				<Label htmlFor="stackAmount">
					Stack Amount <span className="text-destructive">*</span>
				</Label>
				<Input
					id="stackAmount"
					inputMode="numeric"
					min={0}
					onChange={(e) => setStackAmount(e.target.value)}
					placeholder="0"
					required
					type="number"
					value={stackAmount}
				/>
			</div>

			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<Label>All-ins</Label>
					<Button
						onClick={handleAddAllInClick}
						size="sm"
						type="button"
						variant="outline"
					>
						Add All-in
					</Button>
				</div>

				{allIns.length > 0 && (
					<div className="flex flex-wrap gap-2">
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
					</div>
				)}
			</div>

			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<Label>Addon</Label>
					{addon === null ? (
						<Button
							onClick={handleAddAddonClick}
							size="sm"
							type="button"
							variant="outline"
						>
							Add Addon
						</Button>
					) : (
						<EventBadge
							data={{ amount: addon.amount }}
							onDelete={handleAddonDelete}
							onEdit={handleAddonBadgeClick}
							type="addon"
						/>
					)}
				</div>
			</div>

			<Button className="mt-2" disabled={isLoading} type="submit">
				{isLoading ? "Saving..." : "Save Stack"}
			</Button>

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
		</form>
	);
}
