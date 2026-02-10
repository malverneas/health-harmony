import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Users, Calendar, FileText, Pill, TrendingUp, TrendingDown } from "lucide-react";

const stats = [
  { label: "Total Users", value: "1,234", change: "+12%", trend: "up", icon: Users },
  { label: "Consultations", value: "456", change: "+8%", trend: "up", icon: Calendar },
  { label: "Prescriptions", value: "789", change: "+15%", trend: "up", icon: FileText },
  { label: "Fulfilled Orders", value: "321", change: "-3%", trend: "down", icon: Pill },
];

export default function AnalyticsPage() {
  return (
    <DashboardLayout requiredRole="admin">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Analytics</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stats.map((stat) => (
            <GlassCard key={stat.label} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  <div className={`flex items-center gap-1 mt-2 text-sm ${stat.trend === "up" ? "text-green-500" : "text-red-500"}`}>
                    {stat.trend === "up" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {stat.change}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-primary" />
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        <GlassCard className="p-6">
          <h2 className="font-semibold mb-4">Activity Overview</h2>
          <div className="h-48 flex items-center justify-center text-muted-foreground">
            Chart placeholder — connect backend for real data
          </div>
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}
