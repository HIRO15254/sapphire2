import { IconSparkles } from "@tabler/icons-react";
import { LocalBlindStructureContent } from "@/features/stores/components/blind-level-editor";
import { TournamentForm } from "@/features/stores/components/tournament-form";
import type { BlindLevelRow } from "@/features/stores/hooks/use-blind-levels";
import type { TournamentFormValues } from "@/features/stores/hooks/use-tournaments";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/shared/components/ui/tabs";
import { useTournamentModalContent } from "./use-tournament-modal-content";

export type TournamentPartialFormValues = Omit<
	TournamentFormValues,
	"tags" | "chipPurchases"
> & {
	chipPurchases?: Array<{ name: string; cost: number; chips: number }>;
	tags?: string[];
};

interface TournamentModalContentProps {
	/**
	 * Form id shared with the surrounding FormSheet's Save button (V2). When
	 * omitted, the inner form renders its own Save button (legacy consumers).
	 */
	formId?: string;
	initialBlindLevels: BlindLevelRow[];
	initialFormValues?: TournamentPartialFormValues;
	/** Drives the legacy in-form Save button when no `formId` is supplied. */
	isLoading?: boolean;
	/** Opens the AI auto-fill sheet (V2 body button). Omitted disables it. */
	onOpenAi?: () => void;
	onSave: (
		values: TournamentFormValues,
		levels: BlindLevelRow[]
	) => void | Promise<void>;
}

export function TournamentModalContent({
	formId,
	initialBlindLevels,
	initialFormValues,
	isLoading = false,
	onOpenAi,
	onSave,
}: TournamentModalContentProps) {
	const { localBlindLevels, setLocalBlindLevels } = useTournamentModalContent({
		initialBlindLevels,
	});

	return (
		<div className="flex flex-col gap-3">
			{onOpenAi ? (
				<Button
					className="self-start"
					onClick={onOpenAi}
					size="sm"
					type="button"
					variant="outline"
				>
					<IconSparkles size={14} />
					Auto-fill with AI
					<Badge className="px-1 py-0 text-[10px]" variant="secondary">
						beta
					</Badge>
				</Button>
			) : null}
			<Tabs defaultValue="details">
				<TabsList className="w-full">
					<TabsTrigger value="details">Details</TabsTrigger>
					<TabsTrigger value="structure">Structure</TabsTrigger>
				</TabsList>
				<TabsContent value="details">
					<TournamentForm
						defaultValues={initialFormValues}
						formId={formId}
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
		</div>
	);
}
