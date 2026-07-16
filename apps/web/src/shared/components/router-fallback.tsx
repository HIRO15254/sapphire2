import { Link } from "@tanstack/react-router";
import { Button } from "@/shared/components/ui/button";

export function RouterErrorFallback() {
	return (
		<div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
			<h1 className="t-h2">Something went wrong</h1>
			<p className="text-muted-foreground text-sm" role="alert">
				Please try again or return to Statistics.
			</p>
			<Button asChild>
				<Link to="/statistics">Go to Statistics</Link>
			</Button>
		</div>
	);
}

export function RouterNotFoundFallback() {
	return (
		<div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
			<h1 className="t-h2">Page not found</h1>
			<Button asChild>
				<Link to="/statistics">Go to Statistics</Link>
			</Button>
		</div>
	);
}
