import { TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import type { BlindSlotLabels } from "@/shared/hooks/use-variant-labels";
import { BLIND_DATA_COLUMNS } from "../../blind-table-columns";
import type { GameHeaderRow } from "../use-blind-structure-table";

interface BlindStructureTableHeaderProps {
	blindLabels: BlindSlotLabels;
	hasBlind3Column: boolean;
	headerGroups: GameHeaderRow[] | null;
	hybridGames: boolean;
	isMix: boolean;
}

const HEAD_CLASS =
	"h-auto pb-1 text-center font-medium text-muted-foreground text-xs";

function blind3HeaderLabel(
	hybridGames: boolean,
	blindLabels: BlindSlotLabels
): string | null {
	return hybridGames ? "Blind 3" : blindLabels.blind3;
}

export function BlindStructureTableHeader({
	blindLabels,
	hasBlind3Column,
	headerGroups,
	hybridGames,
	isMix,
}: BlindStructureTableHeaderProps) {
	return (
		<TableHeader>
			{headerGroups ? (
				headerGroups.map((group, index) => (
					<TableRow className="hover:bg-transparent" key={group.key}>
						{index === 0 && (
							<TableHead
								className={`${HEAD_CLASS} w-10`}
								rowSpan={headerGroups.length}
							>
								#
							</TableHead>
						)}
						<TableHead className={`${HEAD_CLASS} w-14 text-left`}>
							{group.label}
						</TableHead>
						<TableHead className={HEAD_CLASS}>{group.blind1Label}</TableHead>
						<TableHead className={HEAD_CLASS}>{group.blind2Label}</TableHead>
						{hasBlind3Column && (
							<TableHead className={HEAD_CLASS}>{group.blind3Label}</TableHead>
						)}
						<TableHead className={HEAD_CLASS}>Ante</TableHead>
						{index === 0 && (
							<>
								<TableHead
									className={`${HEAD_CLASS} w-12`}
									rowSpan={headerGroups.length}
								>
									Min
								</TableHead>
								<TableHead
									className="h-auto w-8 pb-1"
									rowSpan={headerGroups.length}
								/>
							</>
						)}
					</TableRow>
				))
			) : (
				<TableRow className="hover:bg-transparent">
					<TableHead className={`${HEAD_CLASS} w-10`}>#</TableHead>
					{hybridGames && (
						<TableHead className={`${HEAD_CLASS} w-14 text-left`}>
							Game
						</TableHead>
					)}
					{isMix ? (
						<TableHead className={HEAD_CLASS} colSpan={BLIND_DATA_COLUMNS}>
							Games
						</TableHead>
					) : (
						<>
							<TableHead className={HEAD_CLASS}>
								{hybridGames ? "Blind 1" : blindLabels.blind1}
							</TableHead>
							<TableHead className={HEAD_CLASS}>
								{hybridGames ? "Blind 2" : blindLabels.blind2}
							</TableHead>
							{hasBlind3Column && (
								<TableHead className={HEAD_CLASS}>
									{blind3HeaderLabel(hybridGames, blindLabels)}
								</TableHead>
							)}
							<TableHead className={HEAD_CLASS}>Ante</TableHead>
						</>
					)}
					<TableHead className={`${HEAD_CLASS} w-12`}>Min</TableHead>
					<TableHead className="h-auto w-8 pb-1" />
				</TableRow>
			)}
		</TableHeader>
	);
}
