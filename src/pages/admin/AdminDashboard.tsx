import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MobileNav } from "@/components/layout/MobileNav";
import { GlassCard } from "@/components/layout/GlassCard";
import { Users, Stethoscope, Pill, Activity, ChevronRight, BarChart3, Settings, Loader2, Download, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { downloadAsCSV } from "@/utils/exportUtils";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  action: string;
  user: string;
  time: string;
  type: 'user' | 'pharmacy' | 'warning' | 'activity';
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    doctors: 0,
    pharmacies: 0,
    uptime: "99.9%"
  });
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    fetchAdminStats();
  }, []);

  const fetchAdminStats = async () => {
    setIsLoading(true);
    try {
      const [
        { count: userCount, error: e1 },
        { count: doctorCount, error: e2 },
        { count: pharmacyCount, error: e3 }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'doctor'),
        supabase.from('pharmacies').select('*', { count: 'exact', head: true })
      ]);

      if (e1) console.error('Error counting profiles:', e1);
      if (e2) console.error('Error counting doctors:', e2);
      if (e3) console.error('Error counting pharmacies:', e3);

      setStats(prev => ({
        ...prev,
        totalUsers: userCount || 0,
        doctors: doctorCount || 0,
        pharmacies: pharmacyCount || 0
      }));

      // 2. Fetch Recent Activities
      const { data: recentUsers } = await supabase
        .from('profiles')
        .select('user_id, full_name, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

      const { data: recentOrders } = await supabase
        .from('orders')
        .select('id, created_at, status')
        .order('created_at', { ascending: false })
        .limit(2);

      const activities: ActivityItem[] = [];

      recentUsers?.forEach(u => {
        activities.push({
          id: `u-${u.user_id}`,
          action: "New user registered",
          user: u.full_name || 'Anonymous',
          time: u.created_at ? formatDistanceToNow(new Date(u.created_at), { addSuffix: true }) : 'Recently',
          type: 'user'
        });
      });

      recentOrders?.forEach(o => {
        activities.push({
          id: `o-${o.id}`,
          action: `Order ${o.status.replace(/_/g, ' ')}`,
          user: `Order ID: ...${o.id.slice(-6)}`,
          time: o.created_at ? formatDistanceToNow(new Date(o.created_at), { addSuffix: true }) : 'Recently',
          type: 'activity'
        });
      });

      setRecentActivities(activities);

    } catch (error) {
      console.error('Error fetching admin dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const { data: users } = await supabase.from('profiles').select('full_name, created_at');
      if (users) {
        const exportData = users.map(u => ({
          'Name': u.full_name,
          'Joined': u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'
        }));
        downloadAsCSV(exportData, 'admin_user_list');
      }
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  return (
    <DashboardLayout title="Admin Dashboard" requiredRole="admin">
      <div className="space-y-4 sm:space-y-6 pb-24 lg:pb-6">
        <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-tight">System Management</h2>
            <p className="text-xs text-muted-foreground">Live infrastructure monitoring</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={fetchAdminStats}>
              <Database className="w-4 h-4" />
              Sync
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
              <Download className="w-4 h-4" />
              Users Export
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <GlassCard className="p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <span className="text-xs sm:text-sm text-muted-foreground">Total Users</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{isLoading ? "..." : stats.totalUsers}</p>
            <p className="text-[10px] text-success font-medium mt-1">● Live from DB</p>
          </GlassCard>

          <GlassCard className="p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-secondary/10">
                <Stethoscope className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
              </div>
              <span className="text-xs sm:text-sm text-muted-foreground">Doctors</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{isLoading ? "..." : stats.doctors}</p>
            <p className="text-[10px] text-warning font-medium mt-1">Medical Staff</p>
          </GlassCard>

          <GlassCard className="p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-success/10">
                <Pill className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
              </div>
              <span className="text-xs sm:text-sm text-muted-foreground">Pharmacies</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{isLoading ? "..." : stats.pharmacies}</p>
            <p className="text-[10px] text-success font-medium mt-1">Active Outlets</p>
          </GlassCard>

          <GlassCard className="p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-warning/10">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
              </div>
              <span className="text-xs sm:text-sm text-muted-foreground">Uptime</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{stats.uptime}</p>
            <p className="text-[10px] text-muted-foreground mt-1">System Health</p>
          </GlassCard>
        </div>

        {/* Recent Activity */}
        <GlassCard className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              System Event Stream
            </h3>
            <Button variant="ghost" size="sm" className="text-primary text-xs" onClick={() => navigate('/admin/logs')}>
              Full Logs <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : recentActivities.length === 0 ? (
              <div className="text-center py-10 flex flex-col items-center opacity-40">
                <Database className="w-10 h-10 mb-2" />
                <p className="text-sm">No recent events tracked</p>
              </div>
            ) : (
              recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    activity.type === "user" && "bg-primary",
                    activity.type === "pharmacy" && "bg-success",
                    activity.type === "warning" && "bg-warning",
                    activity.type === "activity" && "bg-secondary"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{activity.action}</p>
                    <p className="text-xs text-muted-foreground truncate">{activity.user}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold shrink-0">{activity.time}</span>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <GlassCard hover className="p-4 cursor-pointer group" onClick={() => navigate('/admin/users')}>
            <div className="p-2.5 sm:p-3 rounded-xl bg-primary/10 w-fit mb-3 transition-colors group-hover:bg-primary/20">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-sm sm:text-base">User Directory</h3>
            <p className="text-xs text-muted-foreground mt-1 text-balance">Review memberships and roles</p>
          </GlassCard>

          <GlassCard hover className="p-4 cursor-pointer group" onClick={() => navigate('/admin/analytics')}>
            <div className="p-2.5 sm:p-3 rounded-xl bg-secondary/10 w-fit mb-3 transition-colors group-hover:bg-secondary/20">
              <BarChart3 className="w-5 h-5 text-secondary" />
            </div>
            <h3 className="font-semibold text-sm sm:text-base">BI Analytics</h3>
            <p className="text-xs text-muted-foreground mt-1 text-balance">Deep dive into usage metrics</p>
          </GlassCard>
        </div>

        {/* Settings Shortcut */}
        <GlassCard hover className="p-4 cursor-pointer" onClick={() => navigate('/admin/logs')}>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-muted/50">
              <Settings className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">System Configuration</h3>
              <p className="text-sm text-muted-foreground">Adjust global rules & protocols</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground opacity-30" />
          </div>
        </GlassCard>
      </div>

      <MobileNav />
    </DashboardLayout>
  );
}
