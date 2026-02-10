import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Calendar, 
  MessageSquare, 
  Pill,
  BarChart3,
  Users
} from "lucide-react";

const roleNavItems = {
  patient: [
    { icon: LayoutDashboard, label: "Home", path: "/patient" },
    { icon: Calendar, label: "Consults", path: "/patient/consultations" },
    { icon: Pill, label: "Orders", path: "/patient/orders" },
    { icon: MessageSquare, label: "Chat", path: "/patient/messages" },
  ],
  doctor: [
    { icon: LayoutDashboard, label: "Home", path: "/doctor" },
    { icon: Calendar, label: "Schedule", path: "/doctor/schedule" },
    { icon: Users, label: "Patients", path: "/doctor/patients" },
    { icon: MessageSquare, label: "Chat", path: "/doctor/messages" },
  ],
  pharmacist: [
    { icon: LayoutDashboard, label: "Home", path: "/pharmacy" },
    { icon: Pill, label: "Inventory", path: "/pharmacy/inventory" },
    { icon: LayoutDashboard, label: "Orders", path: "/pharmacy/orders" },
    { icon: MessageSquare, label: "Chat", path: "/pharmacy/messages" },
  ],
  admin: [
    { icon: LayoutDashboard, label: "Home", path: "/admin" },
    { icon: Users, label: "Users", path: "/admin/users" },
    { icon: BarChart3, label: "Analytics", path: "/admin/analytics" },
    { icon: MessageSquare, label: "Logs", path: "/admin/logs" },
  ],
};

export function MobileNav() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const navItems = roleNavItems[user.role];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card border-t border-border/50 lg:hidden safe-area-inset-bottom">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive && "drop-shadow-[0_0_8px_hsl(var(--primary))]")} />
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
