import { IconCards, IconPlayerPlay, IconPlus } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import {
	crystButton,
	crystIconButton,
} from "@/shared/components/cryst/cryst-controls";
import { CrystEmptyState } from "@/shared/components/cryst/cryst-empty-state";
import { PageHeader } from "@/shared/components/page-header";

import { useHomePage } from "./use-home-page";

const liveTo: string = "/live/new";
const pastTo: string = "/sessions/new";

export function HomePage() {
	const { todayLabel } = useHomePage();
	return (
		<div className="flex min-h-full flex-col">
			<PageHeader
				actions={
					<div className="hidden items-center gap-2 md:flex">
						<Link
							className={crystButton({ variant: "outline", size: "md" })}
							to={pastTo}
						>
							<IconPlus aria-hidden size={16} />
							Add past session
						</Link>
						<Link
							className={crystButton({ variant: "primary", size: "md" })}
							to={liveTo}
						>
							<IconPlayerPlay aria-hidden size={16} />
							Start live session
						</Link>
					</div>
				}
				heading="Home"
				meta={<span className="md:hidden">{todayLabel}</span>}
			/>
			<main className="flex flex-1 flex-col gap-4 px-3.5 pt-3 pb-4 md:p-0">
				<div className="flex items-center gap-2 md:hidden">
					<Link
						className={`${crystButton({ variant: "primary", size: "xl" })} flex-1`}
						to={liveTo}
					>
						<IconPlayerPlay aria-hidden size={17} />
						Start live session
					</Link>
					<Link
						aria-label="Add past session"
						className={crystIconButton({ variant: "outline", size: "xl" })}
						to={pastTo}
					>
						<IconPlus aria-hidden size={18} />
					</Link>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<CrystEmptyState
						description="Start a live session at the table, or add one you already played."
						icon={IconCards}
						title="No sessions yet"
					/>
				</div>
			</main>
		</div>
	);
}
