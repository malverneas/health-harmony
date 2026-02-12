import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users,
  Calendar,
  FileText,
  Pill,
  Loader2,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  Download,
  Clock,
  ShieldAlert,
  Database,
  Bug
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { format, subDays, startOfDay } from "date-fns";
import { downloadAsCSV } from "@/utils/exportUtils";

interface AggregatedStats {
  totalUsers: number;
  totalConsultations: number;
  totalPrescriptions: number;
  totalOrders: number;
  consultationTrend: any[];
  fulfillmentData: any[];
  medicationData: any[];
  roleDistribution: any[];
  recentActivity: any[];
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe'];

export default function AnalyticsPage() {
  const [stats, setStats] = useState<AggregatedStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [debugLog, setDebugLog] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const addDebug = (message: string, data?: any) => {
    setDebugLog(prev => [...prev, { time: new Date().toLocaleTimeString(), message, data }]);
    console.log(`[DEBUG] ${message}`, data);
  };

  const handleExport = async () => {
    if (!stats) return;

    try {
      const [
        { data: consultations },
        { data: prescriptions },
        { data: orders }
      ] = await Promise.all([
        supabase.from('consultations').select('scheduled_at, consultation_type, status, patient_id, doctor_id'),
        supabase.from('prescriptions').select('id, created_at, status, patient_id, doctor_id'),
        supabase.from('orders').select('id, created_at, status, delivery_type, patient_id')
      ]);

      const allUserIds = [...new Set([
        ...(consultations?.map(c => c.patient_id) || []),
        ...(consultations?.map(c => c.doctor_id) || []),
        ...(prescriptions?.map(p => p.patient_id) || []),
        ...(prescriptions?.map(p => p.doctor_id) || []),
        ...(orders?.map(o => o.patient_id) || [])
      ])];

      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', allUserIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      const exportData = [
        { Section: '--- SUMMARY ---', Details: '' },
        { Section: 'Total Users', Details: stats.totalUsers },
        { Section: 'Total Consultations', Details: stats.totalConsultations },
        { Section: 'Total Prescriptions', Details: stats.totalPrescriptions },
        { Section: 'Total Orders', Details: stats.totalOrders },
        { Section: '', Details: '' },
        { Section: '--- RECENT CONSULTATIONS ---', Details: '' },
        ...(consultations?.slice(0, 50).map(c => ({
          Section: profileMap.get(c.patient_id) || 'Unknown Patient',
          Details: `${c.consultation_type} with ${profileMap.get(c.doctor_id) || 'Unknown Doctor'} on ${format(new Date(c.scheduled_at), 'PP')}`
        })) || []),
        { Section: '', Details: '' },
        { Section: '--- RECENT ORDERS ---', Details: '' },
        ...(orders?.slice(0, 50).map(o => ({
          Section: profileMap.get(o.patient_id) || 'Unknown Patient',
          Details: `${o.delivery_type} order (${o.status}) placed on ${format(new Date(o.created_at!), 'PP')}`
        })) || [])
      ];

      downloadAsCSV(exportData, 'system_comprehensive_report');
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setDebugLog([]);
    addDebug('Starting analytics fetch', { userId: user?.id, role: user?.role });

    try {
      const fetchCount = async (table: any) => {
        const response = await supabase.from(table).select('*', { count: 'exact', head: true });
        addDebug(`Count ${table}`, { count: response.count, error: response.error });
        if (response.error) {
          addDebug(`Trying data fetch fallback for ${table}`);
          const fallback = await supabase.from(table).select('id').limit(1);
          addDebug(`Fallback ${table}`, { found: fallback.data?.length, error: fallback.error });
        }
        return response.count || 0;
      };

      const [userCount, consultationCount, prescriptionCount, orderCount] = await Promise.all([
        fetchCount('profiles'),
        fetchCount('consultations'),
        fetchCount('prescriptions'),
        fetchCount('orders')
      ]);

      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), i);
        return {
          date: format(date, 'MMM dd'),
          count: 0,
          rawDate: startOfDay(date)
        };
      }).reverse();

      const { data: recentConsultations, error: trendError } = await supabase
        .from('consultations')
        .select('scheduled_at, patient_id, consultation_type, status')
        .order('scheduled_at', { ascending: false });

      addDebug('Trend Data', { count: recentConsultations?.length, error: trendError });

      recentConsultations?.forEach(c => {
        const cDate = startOfDay(new Date(c.scheduled_at));
        const day = last7Days.find(d => d.rawDate.getTime() === cDate.getTime());
        if (day) day.count++;
      });

      const { data: orderData, error: orderError } = await supabase.from('orders').select('delivery_type, patient_id, status, created_at').order('created_at', { ascending: false }).limit(100);
      addDebug('Fulfillment Data', { count: orderData?.length, error: orderError });

      const fulfillmentCounts = (orderData || []).reduce((acc: any, curr) => {
        acc[curr.delivery_type] = (acc[curr.delivery_type] || 0) + 1;
        return acc;
      }, {});

      const fulfillmentChartData = Object.entries(fulfillmentCounts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value
      }));

      const { data: medItems, error: medError } = await supabase.from('prescription_items').select('medication_name');
      addDebug('Medication Data', { count: medItems?.length, error: medError });

      const medCounts = (medItems || []).reduce((acc: any, curr) => {
        acc[curr.medication_name] = (acc[curr.medication_name] || 0) + 1;
        return acc;
      }, {});

      const medChartData = Object.entries(medCounts)
        .map(([name, count]) => ({ name, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const { data: roles, error: roleError } = await supabase.from('user_roles').select('role');
      addDebug('Role Data', { count: roles?.length, error: roleError });

      const roleCounts = (roles || []).reduce((acc: any, curr) => {
        acc[curr.role] = (acc[curr.role] || 0) + 1;
        return acc;
      }, {});

      const roleChartData = Object.entries(roleCounts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value
      }));

      const patientIds = [...new Set(recentConsultations?.slice(0, 5).map(c => c.patient_id) || [])];
      let profileMap = new Map();

      if (patientIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase.from('profiles').select('user_id, full_name').in('user_id', patientIds);
        profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
      }

      const activityData = recentConsultations?.slice(0, 5).map(c => ({
        id: Math.random().toString(),
        patient: profileMap.get(c.patient_id) || 'Unknown',
        type: c.consultation_type,
        status: c.status,
        time: format(new Date(c.scheduled_at), 'ppp')
      })) || [];

      setStats({
        totalUsers: userCount,
        totalConsultations: consultationCount,
        totalPrescriptions: prescriptionCount,
        totalOrders: orderCount,
        consultationTrend: last7Days,
        fulfillmentData: fulfillmentChartData,
        medicationData: medChartData,
        roleDistribution: roleChartData,
        recentActivity: activityData
      });
      addDebug('State Updated Successfully');
    } catch (error) {
      addDebug('Caught General Error', error);
      console.error('General analytics error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !stats) {
    return (
      <DashboardLayout requiredRole="admin" title="Analytics">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const isDataEmpty = stats.totalUsers === 0 && stats.totalConsultations === 0 && stats.totalOrders === 0;

  return (
    <DashboardLayout requiredRole="admin" title="Analytics">
      <div className="space-y-6 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display">System Reports & BI</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                Role: {user?.role}
              </span>
              <span className="text-[10px] text-muted-foreground underline decoration-dotted"
                onClick={() => setShowDebug(!showDebug)}
                style={{ cursor: 'pointer' }}>
                {user?.email}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowDebug(!showDebug)}>
              <Bug className="w-4 h-4" />
              {showDebug ? 'Hide Debug' : 'Debug Logs'}
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={fetchAnalytics}>
              <Database className="w-4 h-4" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="gap-2 bg-primary/10 text-primary border-primary/20" onClick={handleExport}>
              <Download className="w-4 h-4" />
              Detailed Export
            </Button>
          </div>
        </div>

        {showDebug && (
          <GlassCard className="p-4 bg-black/80 font-mono text-[10px] text-green-400 overflow-auto max-h-[400px]">
            <div className="flex justify-between items-center mb-2 border-b border-green-900 pb-1">
              <span>SYSTEM DIAGNOSTICS</span>
              <button onClick={() => setShowDebug(false)}>X</button>
            </div>
            {debugLog.map((log, i) => (
              <div key={i} className="mb-1">
                <span className="text-green-700">[{log.time}]</span> {log.message}
                {log.data && (
                  <pre className="text-green-500 whitespace-pre-wrap ml-4">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </GlassCard>
        )}

        {isDataEmpty && !showDebug && (
          <GlassCard className="p-4 border-warning/50 bg-warning/5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="text-warning w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-warning">Security Permissions Warning</p>
                <p className="text-xs text-muted-foreground mt-1">
                  All counts are currently returning 0. This is likely because the database Row Level Security (RLS) policies haven't been updated to allow your account to view other users' data. Please ensure the SQL from the implementation plan has been executed in the Supabase Dashboard.
                </p>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Users", value: stats.totalUsers, icon: Users, color: "bg-blue-500/10 text-blue-500" },
            { label: "Consultations", value: stats.totalConsultations, icon: Calendar, color: "bg-purple-500/10 text-purple-500" },
            { label: "Prescriptions", value: stats.totalPrescriptions, icon: FileText, color: "bg-green-500/10 text-green-500" },
            { label: "Orders", value: stats.totalOrders, icon: Pill, color: "bg-orange-500/10 text-orange-500" },
          ].map((stat) => (
            <GlassCard key={stat.label} className="p-4 border-none transition-all hover:bg-white/5">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${stat.color} shrink-0`}>
                  <stat.icon size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold truncate">{stat.label}</p>
                  <p className="text-lg sm:text-xl font-bold">{stat.value.toLocaleString()}</p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Consultation Trend */}
          <GlassCard className="p-6">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Live Consultation Trends
            </h2>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.consultationTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="date" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="var(--primary)"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "var(--primary)" }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Recent Detailed Activity */}
          <GlassCard className="p-6">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-secondary" />
              Latest Transactions
            </h2>
            <div className="space-y-4">
              {stats.recentActivity.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center gap-2">
                  <Database className="w-10 h-10 text-muted-foreground/20" />
                  <p className="text-muted-foreground text-sm">No recent activity detected.</p>
                </div>
              ) : (
                stats.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-white/5">
                    <div>
                      <p className="font-medium text-sm">{activity.patient}</p>
                      <p className="text-xs text-muted-foreground">{activity.type} • {activity.time}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full uppercase font-bold ${activity.status === 'completed' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                      }`}>
                      {activity.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </GlassCard>

          {/* Fulfillment Preference */}
          <GlassCard className="p-6">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-success" />
              Fulfillment Distribution
            </h2>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.fulfillmentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.fulfillmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '12px' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Top Medications */}
          <GlassCard className="p-6">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-warning" />
              Prescription Analytics
            </h2>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.medicationData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.1)" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" stroke="#888" fontSize={12} width={100} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '12px' }}
                  />
                  <Bar dataKey="count" fill="#ffc658" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
