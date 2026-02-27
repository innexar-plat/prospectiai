import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--bg-primary)",
                foreground: "var(--text-primary)",
                card: "var(--bg-card)",
                "card-hover": "var(--bg-card-hover)",
                "bg-input": "var(--bg-input)",
                border: "var(--border-color)",
                "border-focus": "var(--border-focus)",
                muted: "var(--text-muted)",
                primary: {
                    DEFAULT: "var(--accent-primary)",
                    hover: "var(--accent-primary-hover)",
                },
                success: "var(--accent-success)",
                warning: "var(--accent-warning)",
                danger: "var(--accent-danger)",
            },
            borderRadius: {
                sm: "var(--radius-sm)",
                md: "var(--radius-md)",
                lg: "var(--radius-lg)",
                xl: "var(--radius-xl)",
            },
            boxShadow: {
                sm: "var(--shadow-sm)",
                md: "var(--shadow-md)",
                lg: "var(--shadow-lg)",
                glow: "var(--shadow-glow)",
            },
        },
    },
    plugins: [],
};
export default config;
