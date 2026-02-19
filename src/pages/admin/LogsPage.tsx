import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, User, FileText, AlertTriangle, Loader2, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface LogEntry {
  id: string;
  action: string;
  user: string;
  type: 'auth' | 'prescription' | 'order' | 'consultation' | 'warning';
  time: string;
  rawTime: Date;
}

const typeConfig: Record<string, { color: string; icon: typeof Activity }> = {
  auth: { color: "bg-blue-500/20 text-blue-500", icon: User },
  prescription: { color: "bg-purple-500/20 text-purple-500", icon: FileText },
  consultation: { color: "bg-indigo-500/20 text-indigo-500", icon: Activity },
  warning: { color: "bg-yellow-500/20 text-yellow-500", icon: AlertTriangle },
  order: { color: "bg-green-500/20 text-green-500", icon: Activity },
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      // Aggregate recent events from multiple tables
      const [
        { data: recentUsers },
        { data: recentOrders },
        { data: recentConsultations }
      ] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, created_at').order('created_at', { ascending: false }).limit(10),
        supabase.from('orders').select('id, created_at, status, patient_id').order('created_at', { ascending: false }).limit(10),
        supabase.from('consultations').select('id, scheduled_at, status, patient_id').order('scheduled_at', { ascending: false }).limit(10)
      ]);

      const consolidatedLogs: LogEntry[] = [];

      recentUsers?.forEach(u => {
        consolidatedLogs.push({
          id: `u-${u.user_id}`,
          action: "New user registered",
          user: u.full_name || 'Anonymous',
          type: 'auth',
          time: u.created_at ? formatDistanceToNow(new Date(u.created_at), { addSuffix: true }) : 'Recently',
          rawTime: new Date(u.created_at || new Date())
        });
      });

      recentOrders?.forEach(o => {
        consolidatedLogs.push({
          id: `o-${o.id}`,
          action: `Order status: ${o.status}`,
          user: `Patient ID: ...${o.patient_id.slice(-6)}`,
          type: 'order',
          time: o.created_at ? formatDistanceToNow(new Date(o.created_at), { addSuffix: true }) : 'Recently',
          rawTime: o.created_at ? new Date(o.created_at) : new Date()
        });
      });

      recentConsultations?.forEach(c => {
        consolidatedLogs.push({
          id: `c-${c.id}`,
          action: `Consultation ${c.status}`,
          user: `Patient ID: ...${c.patient_id.slice(-6)}`,
          type: 'consultation',
          time: c.scheduled_at ? formatDistanceToNow(new Date(c.scheduled_at), { addSuffix: true }) : 'Recently',
          rawTime: new Date(c.scheduled_at)
        });
      });

      // Sort by time descending
      setLogs(consolidatedLogs.sort((a, b) => b.rawTime.getTime() - a.rawTime.getTime()));
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <DashboardLayout requiredRole="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">System Event Logs</h1>
          <Button variant="outline" size="sm" className="gap-2" onClick={fetchLogs}>
            <Database className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <GlassCard className="p-12 text-center opacity-50">
            <Activity className="w-12 h-12 mx-auto mb-4" />
            <p>No system entries detected yet.</p>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const config = typeConfig[log.type] || typeConfig.auth;
              const Icon = config.icon;
              return (
                <GlassCard key={log.id} className="p-4 border-white/5 hover:bg-white/5 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full ${config.color.split(" ")[0]} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-4 h-4 ${config.color.split(" ")[1]}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm sm:text-base">{log.action}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">{log.user}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge className={config.color}>{log.type}</Badge>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 uppercase font-bold tracking-tight">{log.time}</p>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
