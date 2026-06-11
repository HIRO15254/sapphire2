import { IconCheck } from "@tabler/icons-react";
import { Badge } from "@/shared/components/ui/badge";
import type { WizardStep } from "../use-session-wizard";

function stepVariant(
	isActive: boolean,
	isDone: boolean
): "default" | "secondary" | "outline" {
	if (isActive) {
		return "default";
	}
	if (isDone) {
		return "secondary";
	}
	return "outline";
}

export function StepperBar({
	currentStep,
	steps,
}: {
	currentStep: WizardStep;
	steps: ReadonlyArray<{ key: WizardStep; label: string }>;
}) {
	return (
		<div className="flex items-center gap-2">
			{steps.map((step, idx) => {
				const stepIdx = steps.findIndex((s) => s.key === currentStep);
				const isActive = step.key === currentStep;
				const isDone = idx < stepIdx;
				return (
					<div className="flex items-center gap-2" key={step.key}>
						<Badge
							className="h-6 w-6 justify-center p-0"
							variant={stepVariant(isActive, isDone)}
						>
							{isDone ? <IconCheck size={12} /> : idx + 1}
						</Badge>
						<span
							className={
								isActive
									? "font-medium text-sm"
									: "text-muted-foreground text-sm"
							}
						>
							{step.label}
						</span>
						{idx < steps.length - 1 && (
							<span className="mx-1 text-muted-foreground">/</span>
						)}
					</div>
				);
			})}
		</div>
	);
}
