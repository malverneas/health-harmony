import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MobileNav } from "@/components/layout/MobileNav";
import { GlassCard } from "@/components/layout/GlassCard";
import { Users, Stethoscope, Pill, Activity, ChevronRight, BarChart3, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const recentActivity = [
  { id: "1", action: "New doctor registered", user: "Dr. James Wilson", time: "2 min ago", type: "user" },
  { id: "2", action: "Pharmacy approved", user: "MedCare Pharmacy", time: "15 min ago", type: "pharmacy" },
  { id: "3", action: "User suspended", user: "john.doe@email.com", time: "1 hour ago", type: "warning" },
];

export default function AdminDashboard() {
  return (
    <DashboardLayout title="Admin Dashboard" requiredRole="admin">
      <div className="space-y-4 sm:space-y-6 pb-24 lg:pb-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <GlassCard className="p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <span className="text-xs sm:text-sm text-muted-foreground">Total Users</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">2,456</p>
            <p className="text-xs text-success mt-1">+124 this month</p>
          </GlassCard>

          <GlassCard className="p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-secondary/10">
                <Stethoscope className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
              </div>
              <span className="text-xs sm:text-sm text-muted-foreground">Doctors</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">89</p>
            <p className="text-xs text-warning mt-1">5 pending approval</p>
          </GlassCard>

          <GlassCard className="p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-success/10">
                <Pill className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
              </div>
              <span className="text-xs sm:text-sm text-muted-foreground">Pharmacies</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">34</p>
            <p className="text-xs text-success mt-1">98% fulfillment</p>
          </GlassCard>

          <GlassCard className="p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-warning/10">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
              </div>
              <span className="text-xs sm:text-sm text-muted-foreground">Uptime</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">99.9%</p>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </GlassCard>
        </div>

        {/* Recent Activity */}
        <GlassCard className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Recent Activity
            </h3>
            <Button variant="ghost" size="sm" className="text-primary text-xs sm:text-sm">
              View Logs <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <div 
                key={activity.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/30"
              >
                <div className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  activity.type === "user" && "bg-primary",
                  activity.type === "pharmacy" && "bg-success",
                  activity.type === "warning" && "bg-warning"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{activity.action}</p>
                  <p className="text-xs text-muted-foreground truncate">{activity.user}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{activity.time}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <GlassCard hover className="p-4 cursor-pointer">
            <div className="p-2.5 sm:p-3 rounded-xl bg-primary/10 w-fit mb-3">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-sm sm:text-base">Manage Users</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Approve & suspend</p>
          </GlassCard>

          <GlassCard hover className="p-4 cursor-pointer">
            <div className="p-2.5 sm:p-3 rounded-xl bg-secondary/10 w-fit mb-3">
              <BarChart3 className="w-5 h-5 text-secondary" />
            </div>
            <h3 className="font-semibold text-sm sm:text-base">Analytics</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">View reports</p>
          </GlassCard>
        </div>

        {/* Settings Shortcut */}
        <GlassCard hover className="p-4 cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-muted">
              <Settings className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">System Settings</h3>
              <p className="text-sm text-muted-foreground">Configure platform settings</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </GlassCard>
      </div>
      
      <MobileNav />
    </DashboardLayout>
  );
}
