import { GlassCard } from "@/components/layout/GlassCard";
import { 
  Calendar, 
  Video, 
  MessageSquare, 
  FileText, 
  Pill, 
  ClipboardList,
  Users,
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { UserRole } from "@/types";

interface QuickAction {
  icon: typeof Calendar;
  label: string;
  description: string;
  path: string;
  color: string;
}

const roleActions: Record<UserRole, QuickAction[]> = {
  patient: [
    {
      icon: Calendar,
      label: "Book Consultation",
      description: "Schedule a new appointment",
      path: "/patient/consultations/book",
      color: "bg-primary/10 text-primary",
    },
    {
      icon: Video,
      label: "Video Call",
      description: "Start an online consultation",
      path: "/patient/consultations",
      color: "bg-secondary/10 text-secondary",
    },
    {
      icon: FileText,
      label: "View Prescriptions",
      description: "Check your medications",
      path: "/patient/prescriptions",
      color: "bg-success/10 text-success",
    },
    {
      icon: MessageSquare,
      label: "Message Doctor",
      description: "Chat with your physician",
      path: "/patient/messages",
      color: "bg-warning/10 text-warning",
    },
  ],
  doctor: [
    {
      icon: Calendar,
      label: "Today's Schedule",
      description: "View appointments",
      path: "/doctor/schedule",
      color: "bg-primary/10 text-primary",
    },
    {
      icon: ClipboardList,
      label: "Write Prescription",
      description: "Create new prescription",
      path: "/doctor/prescriptions/new",
      color: "bg-secondary/10 text-secondary",
    },
    {
      icon: Users,
      label: "Patient Records",
      description: "View patient history",
      path: "/doctor/patients",
      color: "bg-success/10 text-success",
    },
    {
      icon: Video,
      label: "Start Consultation",
      description: "Begin video session",
      path: "/doctor/consultations",
      color: "bg-warning/10 text-warning",
    },
  ],
  pharmacist: [
    {
      icon: FileText,
      label: "New Prescriptions",
      description: "Review incoming orders",
      path: "/pharmacy/prescriptions",
      color: "bg-primary/10 text-primary",
    },
    {
      icon: Pill,
      label: "Inventory",
      description: "Manage stock levels",
      path: "/pharmacy/inventory",
      color: "bg-secondary/10 text-secondary",
    },
    {
      icon: ClipboardList,
      label: "Pending Orders",
      description: "Process fulfillments",
      path: "/pharmacy/orders",
      color: "bg-success/10 text-success",
    },
    {
      icon: MessageSquare,
      label: "Messages",
      description: "Contact doctors/patients",
      path: "/pharmacy/messages",
      color: "bg-warning/10 text-warning",
    },
  ],
  admin: [
    {
      icon: Users,
      label: "Manage Users",
      description: "User administration",
      path: "/admin/users",
      color: "bg-primary/10 text-primary",
    },
    {
      icon: BarChart3,
      label: "Analytics",
      description: "View system metrics",
      path: "/admin/analytics",
      color: "bg-secondary/10 text-secondary",
    },
    {
      icon: ClipboardList,
      label: "System Logs",
      description: "Monitor activities",
      path: "/admin/logs",
      color: "bg-success/10 text-success",
    },
    {
      icon: Pill,
      label: "Pharmacies",
      description: "Manage pharmacy network",
      path: "/admin/pharmacies",
      color: "bg-warning/10 text-warning",
    },
  ],
};

interface QuickActionsProps {
  role: UserRole;
}

export function QuickActions({ role }: QuickActionsProps) {
  const navigate = useNavigate();
  const actions = roleActions[role];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {actions.map((action, index) => (
        <GlassCard 
          key={action.path}
          hover
          className={cn(
            "p-4 cursor-pointer animate-slide-up",
          )}
          style={{ animationDelay: `${index * 100}ms` }}
          onClick={() => navigate(action.path)}
        >
          <div className={cn("p-3 rounded-xl w-fit mb-3", action.color)}>
            <action.icon className="w-5 h-5" />
          </div>
          <h3 className="font-semibold mb-1">{action.label}</h3>
          <p className="text-sm text-muted-foreground">{action.description}</p>
        </GlassCard>
      ))}
    </div>
  );
}
