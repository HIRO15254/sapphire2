import { IconCloudOff, IconFileOff } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { CRYST_SCOPE_CLASS } from "@/shared/components/cryst/cryst-scope";
import { Button } from "@/shared/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/shared/components/ui/empty";

export function RouterErrorFallback() {
	return (
		<Empty className={`${CRYST_SCOPE_CLASS} min-h-full bg-background p-6`}>
			<EmptyHeader role="alert">
				<EmptyMedia>
					<IconCloudOff aria-hidden />
				</EmptyMedia>
				<EmptyTitle>Something went wrong</EmptyTitle>
				<EmptyDescription>Please try again or return to Home.</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button asChild size="xl" variant="outline">
					<Link to="/">Go to Home</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}

export function RouterNotFoundFallback() {
	return (
		<Empty className={`${CRYST_SCOPE_CLASS} min-h-full bg-background p-6`}>
			<EmptyHeader>
				<EmptyMedia>
					<IconFileOff aria-hidden />
				</EmptyMedia>
				<EmptyTitle>Page not found</EmptyTitle>
			</EmptyHeader>
			<EmptyContent>
				<Button asChild size="xl" variant="outline">
					<Link to="/">Go to Home</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}
