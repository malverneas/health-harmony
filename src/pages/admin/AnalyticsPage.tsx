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
  RadialBarChart,
  RadialBar,
} from "recharts";
import { format, subDays, startOfDay, parseISO } from "date-fns";
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
  const { user } = useAuth();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleExport = async () => {
    if (!data) return;
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
        { Section: 'Total Users', Details: data.totalUsers },
        { Section: 'Total Consultations', Details: data.totalConsultations },
        { Section: 'Total Prescriptions', Details: data.totalPrescriptions },
        { Section: 'Total Orders', Details: data.totalOrders },
        { Section: '', Details: '' },
        { Section: '--- CONSULTATIONS ---', Details: '' },
        ...(consultations?.slice(0, 50).map(c => ({
          Section: profileMap.get(c.patient_id) || 'Unknown Patient',
          Details: `${c.consultation_type} with ${profileMap.get(c.doctor_id) || 'Doctor'} on ${format(new Date(c.scheduled_at), 'PP')}`
        })) || []),
        { Section: '', Details: '' },
        { Section: '--- ORDERS ---', Details: '' },
        ...(orders?.slice(0, 50).map(o => ({
          Section: profileMap.get(o.patient_id) || 'Unknown',
          Details: `${o.delivery_type} (${o.status}) on ${format(new Date(o.created_at!), 'PP')}`
        })) || [])
      ];

      downloadAsCSV(exportData, 'system_analytics_report');
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      // 1. Total counts
      const [
        { count: userCount },
        { count: consultationCount },
        { count: prescriptionCount },
        { count: orderCount }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('consultations').select('*', { count: 'exact', head: true }),
        supabase.from('prescriptions').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true })
      ]);

      // 2. User growth (last 30 days)
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('created_at')
        .order('created_at', { ascending: true });

      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = subDays(new Date(), 29 - i);
        return { date: format(date, 'MMM dd'), rawDate: startOfDay(date), users: 0, cumulative: 0 };
      });

      let cumulative = 0;
      // Count users that signed up before our window
      allProfiles?.forEach(p => {
        if (p.created_at) {
          const pDate = startOfDay(new Date(p.created_at));
          if (pDate < last30Days[0].rawDate) {
            cumulative++;
          }
        }
      });

      last30Days.forEach(day => {
        const count = allProfiles?.filter(p => {
          if (!p.created_at) return false;
          const pDate = startOfDay(new Date(p.created_at));
          return pDate.getTime() === day.rawDate.getTime();
        }).length || 0;
        day.users = count;
        cumulative += count;
        day.cumulative = cumulative;
      });

      // 3. Consultation trends (last 14 days)
      const { data: allConsultations } = await supabase
        .from('consultations')
        .select('scheduled_at, consultation_type, status, patient_id')
        .order('scheduled_at', { ascending: false });

      const last14Days = Array.from({ length: 14 }, (_, i) => {
        const date = subDays(new Date(), 13 - i);
        return { date: format(date, 'MMM dd'), rawDate: startOfDay(date), count: 0 };
      });

      allConsultations?.forEach(c => {
        const cDate = startOfDay(new Date(c.scheduled_at));
        const day = last14Days.find(d => d.rawDate.getTime() === cDate.getTime());
        if (day) day.count++;
      });

      // 4. Consultation types
      const typeCounts = (allConsultations || []).reduce((acc: Record<string, number>, c) => {
        const type = c.consultation_type || 'Unknown';
        const label = type.charAt(0).toUpperCase() + type.slice(1);
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {});
      const consultationTypes = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));

      // 5. Prescription statuses
      const { data: allPrescriptions } = await supabase
        .from('prescriptions')
        .select('status, created_at');

      const statusCounts = (allPrescriptions || []).reduce((acc: Record<string, number>, p) => {
        const label = STATUS_LABELS[p.status] || p.status;
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {});
      const prescriptionStatuses = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

      // 6. Role distribution
      const { data: roles } = await supabase.from('user_roles').select('role');
      const roleCounts = (roles || []).reduce((acc: Record<string, number>, r) => {
        const label = r.role.charAt(0).toUpperCase() + r.role.slice(1);
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {});
      const roleDistribution = Object.entries(roleCounts).map(([name, value]) => ({
        name,
        value,
        fill: ROLE_COLORS[name] || '#8884d8',
      }));

      // 7. Top medications
      const { data: medItems } = await supabase.from('prescription_items').select('medication_name');
      const medCounts = (medItems || []).reduce((acc: Record<string, number>, m) => {
        acc[m.medication_name] = (acc[m.medication_name] || 0) + 1;
        return acc;
      }, {});
      const topMedications = Object.entries(medCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      // 8. Fulfillment (orders by delivery_type)
      const { data: orderData } = await supabase.from('orders').select('delivery_type, status, created_at');
      const fulfillCounts = (orderData || []).reduce((acc: Record<string, number>, o) => {
        const type = (o.delivery_type || 'unknown').charAt(0).toUpperCase() + (o.delivery_type || 'unknown').slice(1);
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});
      const fulfillmentData = Object.entries(fulfillCounts).map(([name, value]) => ({ name, value }));

      // 9. Order statuses
      const orderStatusCounts = (orderData || []).reduce((acc: Record<string, number>, o) => {
        const label = o.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {});
      const orderStatusData = Object.entries(orderStatusCounts).map(([name, value]) => ({ name, value }));

      // 10. Recent activity
      const patientIds = [...new Set(allConsultations?.slice(0, 10).map(c => c.patient_id) || [])];
      let profileMap = new Map();
      if (patientIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', patientIds);
        profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
      }

      const recentActivity = allConsultations?.slice(0, 8).map(c => ({
        id: Math.random().toString(),
        patient: profileMap.get(c.patient_id) || 'Unknown',
        type: c.consultation_type,
        status: c.status,
        time: format(new Date(c.scheduled_at), 'PP p')
      })) || [];

      // 11. Weekly comparison
      const thisWeekStart = subDays(new Date(), 7);
      const lastWeekStart = subDays(new Date(), 14);

      const thisWeekConsultations = allConsultations?.filter(c => new Date(c.scheduled_at) >= thisWeekStart).length || 0;
      const lastWeekConsultations = allConsultations?.filter(c => {
        const d = new Date(c.scheduled_at);
        return d >= lastWeekStart && d < thisWeekStart;
      }).length || 0;

      const thisWeekPrescriptions = allPrescriptions?.filter(p => p.created_at && new Date(p.created_at) >= thisWeekStart).length || 0;
      const lastWeekPrescriptions = allPrescriptions?.filter(p => {
        if (!p.created_at) return false;
        const d = new Date(p.created_at);
        return d >= lastWeekStart && d < thisWeekStart;
      }).length || 0;

      const thisWeekOrders = orderData?.filter(o => o.created_at && new Date(o.created_at) >= thisWeekStart).length || 0;
      const lastWeekOrders = orderData?.filter(o => {
        if (!o.created_at) return false;
        const d = new Date(o.created_at);
        return d >= lastWeekStart && d < thisWeekStart;
      }).length || 0;

      const calcChange = (curr: number, prev: number) => prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

      const weeklyComparison = [
        { metric: 'Consultations', thisWeek: thisWeekConsultations, lastWeek: lastWeekConsultations, change: calcChange(thisWeekConsultations, lastWeekConsultations) },
        { metric: 'Prescriptions', thisWeek: thisWeekPrescriptions, lastWeek: lastWeekPrescriptions, change: calcChange(thisWeekPrescriptions, lastWeekPrescriptions) },
        { metric: 'Orders', thisWeek: thisWeekOrders, lastWeek: lastWeekOrders, change: calcChange(thisWeekOrders, lastWeekOrders) },
      ];

      setData({
        totalUsers: userCount || 0,
        totalConsultations: consultationCount || 0,
        totalPrescriptions: prescriptionCount || 0,
        totalOrders: orderCount || 0,
        userGrowth: last30Days,
        consultationTrend: last14Days,
        consultationTypes,
        prescriptionStatuses,
        roleDistribution,
        topMedications,
        fulfillmentData,
        recentActivity,
        orderStatusData,
        weeklyComparison,
      });
    } catch (error) {
      console.error('Analytics error:', error);
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
          {/* User Growth Area Chart */}
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

          {/* Consultation Trends */}
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
          {/* Consultation Types Pie */}
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

          {/* Role Distribution */}
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
          {/* Prescription Status */}
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

          {/* Top Medications */}
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
          {/* Fulfillment Distribution */}
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

          {/* Order Status */}
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
