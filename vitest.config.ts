import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],
    test: {
        environment: "node",
        globals: true,
        setupFiles: ["./tests/setup.ts"],
        include: ["tests/unit/**/*.{test,spec}.{ts,tsx}"],
        exclude: ["tests/e2e/**", "node_modules/**"],
        coverage: {
            provider: "v8",
            include: ["lib/**/*.ts", "app/**/*.{ts,tsx}"],
            exclude: ["app/**/layout.tsx", "**/*.d.ts"],
            reporter: ["text", "html", "json-summary"],
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./"),
        },
    },
});
