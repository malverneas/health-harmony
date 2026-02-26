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
  Database,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
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
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { downloadAsCSV } from "@/utils/exportUtils";

interface AnalyticsData {
  totalUsers: number;
  totalConsultations: number;
  totalPrescriptions: number;
  totalOrders: number;
  userGrowth: { date: string; users: number; cumulative: number }[];
  consultationTrend: { date: string; count: number }[];
  consultationTypes: { name: string; value: number }[];
  prescriptionStatuses: { name: string; value: number }[];
  roleDistribution: { name: string; value: number; fill: string }[];
  topMedications: { name: string; count: number }[];
  fulfillmentData: { name: string; value: number }[];
  recentActivity: { id: string; patient: string; type: string; status: string; time: string }[];
  orderStatusData: { name: string; value: number }[];
  weeklyComparison: { metric: string; thisWeek: number; lastWeek: number; change: number }[];
}

const CHART_COLORS = [
  '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#22c55e',
  '#ec4899', '#3b82f6', '#14b8a6', '#f97316', '#a855f7',
];

const ROLE_COLORS: Record<string, string> = {
  Patient: '#3b82f6',
  Doctor: '#8b5cf6',
  Pharmacist: '#22c55e',
  Admin: '#f59e0b',
};

const STATUS_LABELS: Record<string, string> = {
  pending_patient: 'Pending Patient',
  sent: 'Sent',
  acknowledged: 'Acknowledged',
  in_stock: 'In Stock',
  out_of_stock: 'Out of Stock',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Out for Delivery',
  fulfilled: 'Fulfilled',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 backdrop-blur-sm border border-border rounded-xl p-3 shadow-xl">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleExport = async () => {
    if (!data) return;
    try {
      const exportData = [
        { Section: '--- SUMMARY ---', Details: '' },
        { Section: 'Total Users', Details: data.totalUsers },
        { Section: 'Total Consultations', Details: data.totalConsultations },
        { Section: 'Total Prescriptions', Details: data.totalPrescriptions },
        { Section: 'Total Orders', Details: data.totalOrders },
      ];
      downloadAsCSV(exportData, 'system_analytics_report');
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Try the SECURITY DEFINER RPC first (bypasses RLS)
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('get_admin_analytics');

      let allConsultations: any[] = [];
      let allPrescriptions: any[] = [];
      let allOrders: any[] = [];
      let allMedItems: any[] = [];
      let allRoles: any[] = [];
      let allProfiles: any[] = [];
      let totalUsers = 0;
      let totalConsultations = 0;
      let totalPrescriptions = 0;
      let totalOrders = 0;

      if (!rpcError && rpcData) {
        // RPC succeeded — use its data
        totalUsers = rpcData.total_users || 0;
        totalConsultations = rpcData.total_consultations || 0;
        totalPrescriptions = rpcData.total_prescriptions || 0;
        totalOrders = rpcData.total_orders || 0;
        allConsultations = rpcData.consultations || [];
        allPrescriptions = rpcData.prescriptions || [];
        allOrders = rpcData.orders || [];
        allMedItems = rpcData.prescription_items || [];
        allRoles = rpcData.roles || [];
        allProfiles = rpcData.profiles || [];
      } else {
        // Fallback: direct queries (depends on RLS)
        console.warn('RPC failed, falling back to direct queries:', rpcError);
        const [
          { count: uc },
          { count: cc },
          { count: pc },
          { count: oc }
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('consultations').select('*', { count: 'exact', head: true }),
          supabase.from('prescriptions').select('*', { count: 'exact', head: true }),
          supabase.from('orders').select('*', { count: 'exact', head: true })
        ]);
        totalUsers = uc || 0;
        totalConsultations = cc || 0;
        totalPrescriptions = pc || 0;
        totalOrders = oc || 0;

        const [
          { data: c },
          { data: p },
          { data: o },
          { data: m },
          { data: r },
          { data: pr }
        ] = await Promise.all([
          supabase.from('consultations').select('*').order('scheduled_at', { ascending: false }).limit(200),
          supabase.from('prescriptions').select('*').order('created_at', { ascending: false }).limit(200),
          supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200),
          supabase.from('prescription_items').select('medication_name'),
          supabase.from('user_roles').select('user_id, role'),
          supabase.from('profiles').select('user_id, full_name, created_at').order('created_at', { ascending: true })
        ]);
        allConsultations = c || [];
        allPrescriptions = p || [];
        allOrders = o || [];
        allMedItems = m || [];
        allRoles = r || [];
        allProfiles = pr || [];
      }

      // Process: User Growth (30 days)
      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = subDays(new Date(), 29 - i);
        return { date: format(date, 'MMM dd'), rawDate: startOfDay(date), users: 0, cumulative: 0 };
      });

      let cumulative = 0;
      allProfiles.forEach((p: any) => {
        if (p.created_at) {
          const pDate = startOfDay(new Date(p.created_at));
          if (pDate < last30Days[0].rawDate) cumulative++;
        }
      });
      last30Days.forEach(day => {
        const count = allProfiles.filter((p: any) => {
          if (!p.created_at) return false;
          return startOfDay(new Date(p.created_at)).getTime() === day.rawDate.getTime();
        }).length;
        day.users = count;
        cumulative += count;
        day.cumulative = cumulative;
      });

      // Process: Consultation Trends (14 days)
      const last14Days = Array.from({ length: 14 }, (_, i) => {
        const date = subDays(new Date(), 13 - i);
        return { date: format(date, 'MMM dd'), rawDate: startOfDay(date), count: 0 };
      });
      allConsultations.forEach((c: any) => {
        const cDate = startOfDay(new Date(c.scheduled_at));
        const day = last14Days.find(d => d.rawDate.getTime() === cDate.getTime());
        if (day) day.count++;
      });

      // Process: Consultation Types
      const typeCounts = allConsultations.reduce((acc: Record<string, number>, c: any) => {
        const label = (c.consultation_type || 'Unknown').replace(/^\w/, (l: string) => l.toUpperCase());
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {});
      const consultationTypes = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));

      // Process: Prescription Statuses
      const statusCounts = allPrescriptions.reduce((acc: Record<string, number>, p: any) => {
        const label = STATUS_LABELS[p.status] || p.status;
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {});
      const prescriptionStatuses = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

      // Process: Role Distribution
      const roleCounts = allRoles.reduce((acc: Record<string, number>, r: any) => {
        const label = r.role.charAt(0).toUpperCase() + r.role.slice(1);
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {});
      const roleDistribution = Object.entries(roleCounts).map(([name, value]) => ({
        name, value, fill: ROLE_COLORS[name] || '#8884d8',
      }));

      // Process: Top Medications
      const medCounts = allMedItems.reduce((acc: Record<string, number>, m: any) => {
        acc[m.medication_name] = (acc[m.medication_name] || 0) + 1;
        return acc;
      }, {});
      const topMedications = Object.entries(medCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      // Process: Fulfillment
      const fulfillCounts = allOrders.reduce((acc: Record<string, number>, o: any) => {
        const type = (o.delivery_type || 'unknown').replace(/^\w/, (l: string) => l.toUpperCase());
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});
      const fulfillmentData = Object.entries(fulfillCounts).map(([name, value]) => ({ name, value }));

      // Process: Order Statuses
      const osCounts = allOrders.reduce((acc: Record<string, number>, o: any) => {
        const label = (o.status || '').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {});
      const orderStatusData = Object.entries(osCounts).map(([name, value]) => ({ name, value }));

      // Process: Recent Activity
      const patientIds = [...new Set(allConsultations.slice(0, 10).map((c: any) => c.patient_id))];
      const profileMap = new Map(allProfiles.map((p: any) => [p.user_id, p.full_name]));
      const recentActivity = allConsultations.slice(0, 8).map((c: any) => ({
        id: c.id || Math.random().toString(),
        patient: profileMap.get(c.patient_id) || 'Unknown',
        type: c.consultation_type,
        status: c.status,
        time: format(new Date(c.scheduled_at), 'PP p')
      }));

      // Process: Weekly Comparison
      const thisWeekStart = subDays(new Date(), 7);
      const lastWeekStart = subDays(new Date(), 14);
      const calcChange = (curr: number, prev: number) => prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

      const twConsult = allConsultations.filter((c: any) => new Date(c.scheduled_at) >= thisWeekStart).length;
      const lwConsult = allConsultations.filter((c: any) => { const d = new Date(c.scheduled_at); return d >= lastWeekStart && d < thisWeekStart; }).length;
      const twPresc = allPrescriptions.filter((p: any) => p.created_at && new Date(p.created_at) >= thisWeekStart).length;
      const lwPresc = allPrescriptions.filter((p: any) => { if (!p.created_at) return false; const d = new Date(p.created_at); return d >= lastWeekStart && d < thisWeekStart; }).length;
      const twOrders = allOrders.filter((o: any) => o.created_at && new Date(o.created_at) >= thisWeekStart).length;
      const lwOrders = allOrders.filter((o: any) => { if (!o.created_at) return false; const d = new Date(o.created_at); return d >= lastWeekStart && d < thisWeekStart; }).length;

      const weeklyComparison = [
        { metric: 'Consultations', thisWeek: twConsult, lastWeek: lwConsult, change: calcChange(twConsult, lwConsult) },
        { metric: 'Prescriptions', thisWeek: twPresc, lastWeek: lwPresc, change: calcChange(twPresc, lwPresc) },
        { metric: 'Orders', thisWeek: twOrders, lastWeek: lwOrders, change: calcChange(twOrders, lwOrders) },
      ];

      setData({
        totalUsers, totalConsultations, totalPrescriptions, totalOrders,
        userGrowth: last30Days, consultationTrend: last14Days,
        consultationTypes, prescriptionStatuses, roleDistribution,
        topMedications, fulfillmentData, recentActivity, orderStatusData, weeklyComparison,
      });
    } catch (err: any) {
      console.error('Analytics error:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !data) {
    return (
      <DashboardLayout requiredRole="admin" title="BI Analytics">
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading analytics data...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout requiredRole="admin" title="BI Analytics">
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display">Business Intelligence</h1>
            <p className="text-sm text-muted-foreground mt-1">Real-time analytics from your database</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={fetchAnalytics}>
              <Database className="w-4 h-4" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="gap-2 bg-primary/10 text-primary border-primary/20" onClick={handleExport}>
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>

        {error && (
          <GlassCard className="p-4 border-red-500/50 bg-red-500/5">
            <p className="text-sm text-red-400">{error}</p>
          </GlassCard>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Users", value: data.totalUsers, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Consultations", value: data.totalConsultations, icon: Calendar, color: "text-purple-500", bg: "bg-purple-500/10" },
            { label: "Prescriptions", value: data.totalPrescriptions, icon: FileText, color: "text-green-500", bg: "bg-green-500/10" },
            { label: "Orders", value: data.totalOrders, icon: Pill, color: "text-orange-500", bg: "bg-orange-500/10" },
          ].map((stat) => (
            <GlassCard key={stat.label} className="p-4 hover:scale-[1.02] transition-transform">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${stat.bg} shrink-0`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{stat.label}</p>
                  <p className="text-xl font-bold">{stat.value.toLocaleString()}</p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        {/* Week-over-Week Comparison */}
        <GlassCard className="p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
            <TrendingUp className="w-4 h-4 text-primary" />
            Week-over-Week Comparison
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {data.weeklyComparison.map((item) => (
              <div key={item.metric} className="p-4 rounded-xl bg-muted/20 border border-white/5">
                <p className="text-xs text-muted-foreground">{item.metric}</p>
                <div className="flex items-end justify-between mt-2">
                  <div>
                    <p className="text-2xl font-bold">{item.thisWeek}</p>
                    <p className="text-xs text-muted-foreground">this week</p>
                  </div>
                  <div className="text-right">
                    <div className={`flex items-center gap-1 text-sm font-semibold ${item.change >= 0 ? 'text-green-500' : 'text-red-400'
                      }`}>
                      {item.change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      {Math.abs(item.change)}%
                    </div>
                    <p className="text-xs text-muted-foreground">vs {item.lastWeek} last week</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Row 1: User Growth + Consultation Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard className="p-6">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              User Growth (30 Days)
            </h2>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.userGrowth}>
                  <defs>
                    <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" stroke="#888" fontSize={11} tickLine={false} axisLine={false} interval={4} />
                  <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="cumulative" name="Total Users" stroke="#3b82f6" strokeWidth={2.5} fill="url(#userGradient)" />
                  <Bar dataKey="users" name="New Users" fill="#3b82f680" radius={[3, 3, 0, 0]} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-500" />
              Consultation Trends (14 Days)
            </h2>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.consultationTrend}>
                  <defs>
                    <linearGradient id="consultGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" stroke="#888" fontSize={11} tickLine={false} axisLine={false} interval={2} />
                  <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" name="Consultations" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#consultGradient)" dot={{ r: 3, fill: '#8b5cf6' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* Row 2: Consultation Types + Role Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard className="p-6">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-cyan-500" />
              Consultation Types
            </h2>
            <div className="h-[280px] w-full">
              {data.consultationTypes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                  <Database className="w-8 h-8 opacity-20" />
                  <p className="text-sm">No consultations yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.consultationTypes} cx="50%" cy="45%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {data.consultationTypes.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-green-500" />
              User Roles Distribution
            </h2>
            <div className="h-[280px] w-full">
              {data.roleDistribution.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                  <Database className="w-8 h-8 opacity-20" />
                  <p className="text-sm">No user data</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.roleDistribution} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Users" radius={[6, 6, 0, 0]}>
                      {data.roleDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Row 3: Prescription Status + Top Medications */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard className="p-6">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-500" />
              Prescription Status Breakdown
            </h2>
            <div className="h-[280px] w-full">
              {data.prescriptionStatuses.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                  <Database className="w-8 h-8 opacity-20" />
                  <p className="text-sm">No prescriptions yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.prescriptionStatuses} cx="50%" cy="45%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                      {data.prescriptionStatuses.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={50} wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-500" />
              Top Prescribed Medications
            </h2>
            <div className="h-[280px] w-full">
              {data.topMedications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                  <Database className="w-8 h-8 opacity-20" />
                  <p className="text-sm">No medication data</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.topMedications} layout="vertical" barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis type="number" stroke="#888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" stroke="#888" fontSize={11} width={120} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Prescribed" radius={[0, 6, 6, 0]}>
                      {data.topMedications.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Row 4: Fulfillment + Order Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard className="p-6">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Pill className="w-5 h-5 text-pink-500" />
              Order Fulfillment Method
            </h2>
            <div className="h-[280px] w-full">
              {data.fulfillmentData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                  <Database className="w-8 h-8 opacity-20" />
                  <p className="text-sm">No orders yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.fulfillmentData} cx="50%" cy="45%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {data.fulfillmentData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-500" />
              Order Status Distribution
            </h2>
            <div className="h-[280px] w-full">
              {data.orderStatusData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                  <Database className="w-8 h-8 opacity-20" />
                  <p className="text-sm">No orders yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.orderStatusData} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="#888" fontSize={10} tickLine={false} axisLine={false} angle={-20} textAnchor="end" height={50} />
                    <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Orders" radius={[6, 6, 0, 0]}>
                      {data.orderStatusData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Recent Activity Table */}
        <GlassCard className="p-6">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-secondary" />
            Recent Consultations
          </h2>
          {data.recentActivity.length === 0 ? (
            <div className="text-center py-8 flex flex-col items-center gap-2">
              <Database className="w-8 h-8 text-muted-foreground/20" />
              <p className="text-muted-foreground text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-semibold">Patient</th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-semibold">Type</th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-semibold">Status</th>
                    <th className="text-left p-3 text-xs text-muted-foreground uppercase tracking-wider font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentActivity.map((a) => (
                    <tr key={a.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-3 font-medium">{a.patient}</td>
                      <td className="p-3">
                        <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium capitalize">{a.type}</span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${a.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                          a.status === 'scheduled' ? 'bg-blue-500/10 text-blue-500' :
                            'bg-amber-500/10 text-amber-500'
                          }`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{a.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}
