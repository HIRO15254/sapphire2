import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/shared/components/ui/tabs";
import { LocalBlindStructureContent } from "@/stores/components/blind-level-editor";
import { TournamentForm } from "@/stores/components/tournament-form";
import type { BlindLevelRow } from "@/stores/hooks/use-blind-levels";
import { useTournamentModalContent } from "@/stores/hooks/use-tournament-modal-content";
import type { TournamentFormValues } from "@/stores/hooks/use-tournaments";

export type TournamentPartialFormValues = Omit<
	TournamentFormValues,
	"tags" | "chipPurchases"
> & {
	chipPurchases?: Array<{ name: string; cost: number; chips: number }>;
	tags?: string[];
};

interface TournamentModalContentProps {
	initialBlindLevels: BlindLevelRow[];
	initialFormValues?: TournamentPartialFormValues;
	isLoading: boolean;
	onSave: (
		values: TournamentFormValues,
		levels: BlindLevelRow[]
	) => void | Promise<void>;
}

export function TournamentModalContent({
	initialBlindLevels,
	initialFormValues,
	isLoading,
	onSave,
}: TournamentModalContentProps) {
	const { localBlindLevels, setLocalBlindLevels } = useTournamentModalContent({
		initialBlindLevels,
	});

	return (
		<Tabs defaultValue="details">
			<TabsList className="w-full">
				<TabsTrigger value="details">Details</TabsTrigger>
				<TabsTrigger value="structure">Structure</TabsTrigger>
			</TabsList>
			<TabsContent value="details">
				<TournamentForm
					defaultValues={initialFormValues}
					isLoading={isLoading}
					onSubmit={(values) => onSave(values, localBlindLevels)}
				/>
			</TabsContent>
			<TabsContent value="structure">
				<LocalBlindStructureContent
					onChange={setLocalBlindLevels}
					value={localBlindLevels}
					variant={initialFormValues?.variant ?? "nlh"}
				/>
			</TabsContent>
		</Tabs>
	);
}
