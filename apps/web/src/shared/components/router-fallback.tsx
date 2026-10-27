import { IconCloudOff, IconFileOff } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { crystButton } from "@/shared/components/cryst/cryst-controls";
import { CrystEmptyState } from "@/shared/components/cryst/cryst-empty-state";
import { CRYST_SCOPE_CLASS } from "@/shared/components/cryst/cryst-scope";

export function RouterErrorFallback() {
	return (
		<div
			className={`${CRYST_SCOPE_CLASS} flex min-h-full flex-col items-center justify-center gap-4 bg-background p-6 text-foreground`}
		>
			<div role="alert">
				<CrystEmptyState
					description="Please try again or return to Home."
					icon={IconCloudOff}
					title="Something went wrong"
				/>
			</div>
			<Link className={crystButton({ variant: "outline", size: "xl" })} to="/">
				Go to Home
			</Link>
		</div>
	);
}

export function RouterNotFoundFallback() {
	return (
		<div
			className={`${CRYST_SCOPE_CLASS} flex min-h-full flex-col items-center justify-center gap-4 bg-background p-6 text-foreground`}
		>
			<CrystEmptyState icon={IconFileOff} title="Page not found" />
			<Link className={crystButton({ variant: "outline", size: "xl" })} to="/">
				Go to Home
			</Link>
		</div>
	);
}
