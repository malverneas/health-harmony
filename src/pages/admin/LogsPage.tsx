import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Activity, User, FileText, AlertTriangle } from "lucide-react";

const logs = [
  { id: 1, action: "User login", user: "john@example.com", type: "auth", time: "2 min ago" },
  { id: 2, action: "Prescription created", user: "dr.sarah@clinic.com", type: "prescription", time: "15 min ago" },
  { id: 3, action: "Failed login attempt", user: "unknown@test.com", type: "warning", time: "1 hour ago" },
  { id: 4, action: "Order fulfilled", user: "medicare@pharmacy.com", type: "order", time: "2 hours ago" },
  { id: 5, action: "New user registered", user: "emma@example.com", type: "auth", time: "3 hours ago" },
];

const typeConfig: Record<string, { color: string; icon: typeof Activity }> = {
  auth: { color: "bg-blue-500/20 text-blue-500", icon: User },
  prescription: { color: "bg-purple-500/20 text-purple-500", icon: FileText },
  warning: { color: "bg-yellow-500/20 text-yellow-500", icon: AlertTriangle },
  order: { color: "bg-green-500/20 text-green-500", icon: Activity },
};

export default function LogsPage() {
  return (
    <DashboardLayout requiredRole="admin">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">System Logs</h1>

        <div className="space-y-2">
          {logs.map((log) => {
            const config = typeConfig[log.type];
            const Icon = config.icon;
            return (
              <GlassCard key={log.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full ${config.color.split(" ")[0]} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${config.color.split(" ")[1]}`} />
                    </div>
                    <div>
                      <p className="font-medium">{log.action}</p>
                      <p className="text-sm text-muted-foreground">{log.user}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={config.color}>{log.type}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">{log.time}</p>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
