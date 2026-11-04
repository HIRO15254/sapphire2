import {
	type Icon,
	IconCloudOff,
	IconFileOff,
	IconRefresh,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/shared/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/shared/components/ui/empty";

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
		<Empty className="min-h-0 flex-1 px-3.5 py-6">
			<EmptyHeader>
				<EmptyMedia>
					<IconFileOff aria-hidden />
				</EmptyMedia>
				<EmptyTitle>{entity} not found</EmptyTitle>
				<EmptyDescription>It may have been deleted.</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button asChild size="xl" variant="outline">
					<Link to={listHref}>
						{ListIcon ? <ListIcon aria-hidden /> : null}
						Back to {listLabel}
					</Link>
				</Button>
			</EmptyContent>
		</Empty>
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
		<Empty className="min-h-0 flex-1 px-3.5 py-6">
			<EmptyHeader role="alert">
				<EmptyMedia>
					<IconCloudOff aria-hidden />
				</EmptyMedia>
				<EmptyTitle>Couldn't load this {entity}</EmptyTitle>
				<EmptyDescription>
					Check your connection and try again.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button
					aria-busy={isRetrying}
					disabled={isRetrying}
					onClick={onRetry}
					size="xl"
					type="button"
					variant="outline"
				>
					<IconRefresh aria-hidden />
					Retry
				</Button>
			</EmptyContent>
		</Empty>
	);
}
