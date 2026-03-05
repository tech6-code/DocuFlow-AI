import { Moon, Sun, Laptop } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
    const { setTheme, theme } = useTheme()

    return (
        <div role="group" aria-label="Theme selector" className="flex items-center gap-2 bg-muted p-1 rounded-lg border border-border">
            <button
                type="button"
                onClick={() => setTheme("light")}
                className={`p-2 rounded-md transition-all ${theme === "light"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                title="Light Mode"
                aria-label="Use light mode"
                aria-pressed={theme === "light"}
            >
                <Sun className="h-4 w-4" />
            </button>
            <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`p-2 rounded-md transition-all ${theme === "dark"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                title="Dark Mode"
                aria-label="Use dark mode"
                aria-pressed={theme === "dark"}
            >
                <Moon className="h-4 w-4" />
            </button>
            <button
                type="button"
                onClick={() => setTheme("system")}
                className={`p-2 rounded-md transition-all ${theme === "system"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                title="System Theme"
                aria-label="Use system theme"
                aria-pressed={theme === "system"}
            >
                <Laptop className="h-4 w-4" />
            </button>
        </div>
    )
}
