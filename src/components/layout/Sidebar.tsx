import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  FileText,
  MessageSquare,
  Pill,
  Users,
  BarChart3,
  LogOut,
  Stethoscope
} from "lucide-react";
import { Button } from "@/components/ui/button";

const roleNavItems = {
  patient: [
    { icon: LayoutDashboard, label: "Home", path: "/patient" },
    { icon: Calendar, label: "Consultations", path: "/patient/consultations" },
    { icon: FileText, label: "Prescriptions", path: "/patient/prescriptions" },
    { icon: Pill, label: "Orders", path: "/patient/orders" },
    { icon: MessageSquare, label: "Messages", path: "/patient/messages" },
  ],
  doctor: [
    { icon: LayoutDashboard, label: "Home", path: "/doctor" },
    { icon: Calendar, label: "Schedule", path: "/doctor/schedule" },
    { icon: Users, label: "Patients", path: "/doctor/patients" },
    { icon: FileText, label: "Prescriptions", path: "/doctor/prescriptions" },
    { icon: MessageSquare, label: "Messages", path: "/doctor/messages" },
  ],
  pharmacist: [
    { icon: LayoutDashboard, label: "Home", path: "/pharmacy" },
    { icon: FileText, label: "Prescriptions", path: "/pharmacy/prescriptions" },
    { icon: Pill, label: "Inventory", path: "/pharmacy/inventory" },
    { icon: LayoutDashboard, label: "Orders", path: "/pharmacy/orders" },
    { icon: MessageSquare, label: "Messages", path: "/pharmacy/messages" },
  ],
  admin: [
    { icon: LayoutDashboard, label: "Home", path: "/admin" },
    { icon: Users, label: "Users", path: "/admin/users" },
    { icon: BarChart3, label: "Reports", path: "/admin/analytics" },
    { icon: MessageSquare, label: "Logs", path: "/admin/logs" },
  ],
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const navItems = roleNavItems[user.role];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 glass-card border-r border-border/50 transition-transform duration-300 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-5 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold gradient-text">MediConnect</h1>
                <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                    isActive
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium text-sm">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-3 border-t border-border/50">
            <div className="flex items-center gap-3 mb-3 p-2.5 rounded-xl bg-muted/50">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-semibold text-sm">
                  {user.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{user.fullName}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>

            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive text-sm"
              onClick={logout}
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
