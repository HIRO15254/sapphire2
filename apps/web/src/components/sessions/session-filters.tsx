import { IconFilter } from "@tabler/icons-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export interface SessionFilterValues {
	dateFrom?: string;
	dateTo?: string;
	storeId?: string;
	type?: "cash_game" | "tournament";
}

interface SessionFiltersProps {
	filters: SessionFilterValues;
	onFiltersChange: (filters: SessionFilterValues) => void;
	stores: Array<{ id: string; name: string }>;
}

function countActiveFilters(filters: SessionFilterValues): number {
	let count = 0;
	if (filters.type) {
		count++;
	}
	if (filters.storeId) {
		count++;
	}
	if (filters.dateFrom) {
		count++;
	}
	if (filters.dateTo) {
		count++;
	}
	return count;
}

export function SessionFilters({
	filters,
	onFiltersChange,
	stores,
}: SessionFiltersProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [draft, setDraft] = useState<SessionFilterValues>(filters);
	const activeCount = countActiveFilters(filters);

	const handleOpen = () => {
		setDraft(filters);
		setIsOpen(true);
	};

	const handleApply = () => {
		onFiltersChange(draft);
		setIsOpen(false);
	};

	const handleReset = () => {
		const empty: SessionFilterValues = {};
		setDraft(empty);
		onFiltersChange(empty);
		setIsOpen(false);
	};

	return (
		<>
			<Button
				className="relative"
				onClick={handleOpen}
				size="sm"
				variant="outline"
			>
				<IconFilter size={16} />
				Filter
				{activeCount > 0 && (
					<Badge className="ml-1 h-4 min-w-4 px-1 text-[10px]">
						{activeCount}
					</Badge>
				)}
			</Button>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setIsOpen(false);
					}
				}}
				open={isOpen}
				title="Filters"
			>
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<span className="font-medium text-sm">Type</span>
						<Select
							onValueChange={(value) =>
								setDraft({
									...draft,
									type:
										value === "all"
											? undefined
											: (value as "cash_game" | "tournament"),
								})
							}
							value={draft.type ?? "all"}
						>
							<SelectTrigger aria-label="Type" className="w-full">
								<SelectValue placeholder="All Types" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Types</SelectItem>
								<SelectItem value="cash_game">Cash Game</SelectItem>
								<SelectItem value="tournament">Tournament</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="flex flex-col gap-1.5">
						<span className="font-medium text-sm">Store</span>
						<Select
							onValueChange={(value) =>
								setDraft({
									...draft,
									storeId: value === "all" ? undefined : value,
								})
							}
							value={draft.storeId ?? "all"}
						>
							<SelectTrigger aria-label="Store" className="w-full">
								<SelectValue placeholder="All Stores" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Stores</SelectItem>
								{stores.map((s) => (
									<SelectItem key={s.id} value={s.id}>
										{s.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="flex flex-col gap-1.5">
						<span className="font-medium text-sm">Date Range</span>
						<div className="flex gap-2">
							<Input
								className="flex-1"
								onChange={(e) =>
									setDraft({
										...draft,
										dateFrom: e.target.value || undefined,
									})
								}
								placeholder="From"
								type="date"
								value={draft.dateFrom ?? ""}
							/>
							<Input
								className="flex-1"
								onChange={(e) =>
									setDraft({
										...draft,
										dateTo: e.target.value || undefined,
									})
								}
								placeholder="To"
								type="date"
								value={draft.dateTo ?? ""}
							/>
						</div>
					</div>

					<div className="flex gap-2 pt-2">
						<Button className="flex-1" onClick={handleReset} variant="outline">
							Reset
						</Button>
						<Button className="flex-1" onClick={handleApply}>
							Apply
						</Button>
					</div>
				</div>
			</ResponsiveDialog>
		</>
	);
}
