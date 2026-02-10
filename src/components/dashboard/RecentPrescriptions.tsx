import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { FileText, Download, Eye, CheckCircle2, Clock, Truck, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface Prescription {
  id: string;
  doctorName: string;
  date: string;
  medications: number;
  status: "pending" | "ready" | "delivered" | "collected";
}

const mockPrescriptions: Prescription[] = [
  {
    id: "1",
    doctorName: "Dr. Sarah Wilson",
    date: "Dec 14, 2024",
    medications: 3,
    status: "ready",
  },
  {
    id: "2",
    doctorName: "Dr. Michael Chen",
    date: "Dec 10, 2024",
    medications: 2,
    status: "delivered",
  },
  {
    id: "3",
    doctorName: "Dr. Emily Brown",
    date: "Dec 5, 2024",
    medications: 1,
    status: "collected",
  },
];

const statusConfig = {
  pending: { icon: Clock, color: "text-warning", bg: "bg-warning/10", label: "Pending" },
  ready: { icon: Package, color: "text-primary", bg: "bg-primary/10", label: "Ready for Pickup" },
  delivered: { icon: Truck, color: "text-success", bg: "bg-success/10", label: "Delivered" },
  collected: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10", label: "Collected" },
};

export function RecentPrescriptions() {
  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-display font-semibold">Recent Prescriptions</h2>
        <Button variant="ghost" size="sm" className="text-primary">
          View All
        </Button>
      </div>

      <div className="space-y-4">
        {mockPrescriptions.map((prescription, index) => {
          const status = statusConfig[prescription.status];
          const StatusIcon = status.icon;
          
          return (
            <div 
              key={prescription.id}
              className={cn(
                "flex items-center gap-4 p-4 rounded-xl bg-muted/30 transition-all hover:bg-muted/50",
                "animate-slide-up"
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="p-3 rounded-xl bg-secondary/10 text-secondary">
                <FileText className="w-5 h-5" />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{prescription.doctorName}</p>
                <p className="text-sm text-muted-foreground">
                  {prescription.medications} medications • {prescription.date}
                </p>
              </div>

              <div className={cn("flex items-center gap-2 px-3 py-1 rounded-full", status.bg)}>
                <StatusIcon className={cn("w-4 h-4", status.color)} />
                <span className={cn("text-xs font-medium hidden sm:inline", status.color)}>
                  {status.label}
                </span>
              </div>

              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8">
                  <Eye className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
