import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MobileNav } from "@/components/layout/MobileNav";
import { GlassCard } from "@/components/layout/GlassCard";
import { FileText, Truck, Package, CheckCircle2, XCircle, ChevronRight, Pill, MessageSquare } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const incomingPrescriptions = [
  { id: "1", patientName: "John Doe", doctorName: "Dr. Sarah Wilson", medications: 3, time: "5 min ago" },
  { id: "2", patientName: "Sarah Smith", doctorName: "Dr. Michael Chen", medications: 2, time: "15 min ago" },
];

const pendingOrders = [
  { id: "1", patientName: "Alice Walker", type: "pickup", status: "ready", items: 3 },
  { id: "2", patientName: "Bob Martin", type: "delivery", status: "preparing", items: 2 },
];

export default function PharmacyDashboard() {
  const { user } = useAuth();

  return (
    <DashboardLayout title={`${user?.fullName?.split(' ')[0]}'s Pharmacy`} requiredRole="pharmacist">
      <div className="space-y-4 sm:space-y-6 pb-24 lg:pb-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-3">
          <GlassCard className="p-3 sm:p-4 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-primary">{incomingPrescriptions.length}</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">New Rx</p>
          </GlassCard>
          <GlassCard className="p-3 sm:p-4 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-secondary">{pendingOrders.length}</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Orders</p>
          </GlassCard>
          <GlassCard className="p-3 sm:p-4 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-success">6</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Delivered</p>
          </GlassCard>
        </div>

        {/* Incoming Prescriptions */}
        <GlassCard className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              New Prescriptions
            </h3>
            <Button variant="ghost" size="sm" className="text-primary text-xs sm:text-sm">
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <div className="space-y-3">
            {incomingPrescriptions.map((rx) => (
              <div key={rx.id} className="p-3 sm:p-4 rounded-xl bg-muted/30 border-l-4 border-primary">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium">{rx.patientName}</p>
                    <p className="text-sm text-muted-foreground">{rx.doctorName}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{rx.time}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {rx.medications} medication{rx.medications > 1 ? "s" : ""}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 sm:flex-none bg-success hover:bg-success/90">
                    <CheckCircle2 className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">In Stock</span>
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 sm:flex-none">
                    <XCircle className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Unavailable</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <GlassCard hover className="p-4 cursor-pointer">
            <div className="p-2.5 sm:p-3 rounded-xl bg-secondary/10 w-fit mb-3">
              <Package className="w-5 h-5 text-secondary" />
            </div>
            <h3 className="font-semibold text-sm sm:text-base">Pending Orders</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{pendingOrders.length} to process</p>
          </GlassCard>

          <GlassCard hover className="p-4 cursor-pointer">
            <div className="p-2.5 sm:p-3 rounded-xl bg-success/10 w-fit mb-3">
              <Pill className="w-5 h-5 text-success" />
            </div>
            <h3 className="font-semibold text-sm sm:text-base">Inventory</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Manage stock</p>
          </GlassCard>
        </div>

        {/* Messages Shortcut */}
        <GlassCard hover className="p-4 cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-warning/10">
              <MessageSquare className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Messages</h3>
              <p className="text-sm text-muted-foreground">Communicate with doctors & patients</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </GlassCard>
      </div>
      
      <MobileNav />
    </DashboardLayout>
  );
}
