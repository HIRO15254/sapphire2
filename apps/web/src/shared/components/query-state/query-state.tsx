import {
	type Icon,
	IconCloudOff,
	IconFileOff,
	IconRefresh,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import {
	CRYST_BUTTON_ICON_SIZE,
	crystButton,
} from "@/shared/components/cryst/cryst-controls";
import { CrystEmptyState } from "@/shared/components/cryst/cryst-empty-state";

interface NotFoundStateProps {
	entity: string;
	listHref: string;
	listIcon?: Icon;
	listLabel: string;
}

export function NotFoundState({
	entity,
	listHref,
	listLabel,
	listIcon: ListIcon,
}: NotFoundStateProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-3.5 py-6">
			<CrystEmptyState
				description="It may have been deleted."
				icon={IconFileOff}
				title={`${entity} not found`}
			/>
			<Link
				className={crystButton({ size: "xl", variant: "outline" })}
				to={listHref}
			>
				{ListIcon ? (
					<ListIcon aria-hidden size={CRYST_BUTTON_ICON_SIZE.xl} />
				) : null}
				Back to {listLabel}
			</Link>
		</div>
	);
}

interface LoadErrorStateProps {
	entity: string;
	isRetrying: boolean;
	onRetry: () => void;
}

export function LoadErrorState({
	entity,
	isRetrying,
	onRetry,
}: LoadErrorStateProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-3.5 py-6">
			<div role="alert">
				<CrystEmptyState
					description="Check your connection and try again."
					icon={IconCloudOff}
					title={`Couldn't load this ${entity}`}
				/>
			</div>
			<button
				aria-busy={isRetrying}
				className={crystButton({ size: "xl", variant: "outline" })}
				disabled={isRetrying}
				onClick={onRetry}
				type="button"
			>
				<IconRefresh aria-hidden size={CRYST_BUTTON_ICON_SIZE.xl} />
				Retry
			</button>
		</div>
	);
}
