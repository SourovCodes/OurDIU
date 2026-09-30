import { Moon, Sun } from "lucide-react";
import { Button } from "~/components/ui/button";
import { setTheme, useIsDark } from "~/lib/theme";

/** Flips between the light and dark theme. */
export function ThemeToggle() {
  const dark = useIsDark();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {/* Picked by CSS, so the server-rendered icon already matches the page. */}
      <Sun className="hidden dark:block" aria-hidden />
      <Moon className="dark:hidden" aria-hidden />
    </Button>
  );
}
