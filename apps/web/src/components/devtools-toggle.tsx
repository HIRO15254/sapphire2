import { IconBug } from "@tabler/icons-react";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useState } from "react";

type DevtoolsTab = "router" | "query" | null;

export function DevtoolsToggle() {
	const [activeTab, setActiveTab] = useState<DevtoolsTab>(null);

	const toggle = (tab: DevtoolsTab) => {
		setActiveTab((prev) => (prev === tab ? null : tab));
	};

	return (
		<>
			<div className="fixed top-2 right-2 z-50 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 hover:opacity-100">
				<button
					className={`rounded p-1 text-xs transition-colors ${
						activeTab === "router"
							? "bg-primary text-primary-foreground"
							: "bg-muted/80 text-muted-foreground hover:bg-muted"
					}`}
					onClick={() => toggle("router")}
					title="Router Devtools"
					type="button"
				>
					<IconBug size={14} />
				</button>
				<button
					className={`rounded p-1 text-xs transition-colors ${
						activeTab === "query"
							? "bg-primary text-primary-foreground"
							: "bg-muted/80 text-muted-foreground hover:bg-muted"
					}`}
					onClick={() => toggle("query")}
					title="Query Devtools"
					type="button"
				>
					<IconBug className="rotate-45" size={14} />
				</button>
			</div>
			{activeTab === "router" && (
				<div className="fixed inset-x-0 top-8 z-50 mx-auto max-w-[90vw]">
					<TanStackRouterDevtoolsPanel
						style={{ height: "40vh", overflow: "auto" }}
					/>
				</div>
			)}
			{activeTab === "query" && (
				<div className="fixed inset-x-0 top-8 z-50 mx-auto max-w-[90vw]">
					<ReactQueryDevtoolsPanel
						style={{ height: "40vh", overflow: "auto" }}
					/>
				</div>
			)}
		</>
	);
}
