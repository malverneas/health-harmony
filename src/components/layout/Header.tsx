import { Bell, Menu, Search, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/components/ThemeProvider";

interface HeaderProps {
  onMenuClick: () => void;
  title?: string;
}

export function Header({ onMenuClick, title }: HeaderProps) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header className="sticky top-0 z-30 glass-card border-b border-border/50 px-4 lg:px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        {/* Left section */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            <Menu className="w-5 h-5" />
          </Button>

          {title && (
            <h1 className="text-xl lg:text-2xl font-display font-bold hidden sm:block">
              {title}
            </h1>
          )}
        </div>

        {/* Search - hidden on mobile */}
        <div className="hidden md:flex flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-10 bg-muted/30 border-transparent focus:border-primary/50"
            />
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>

          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
          </Button>

          {/* Mobile user avatar */}
          <div className="lg:hidden w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary text-sm font-semibold">
              {user?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
