import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "sqlite",
	out: "./src/migrations",
	schema: "./src/schema",
});
