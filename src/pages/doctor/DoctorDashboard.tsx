import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MobileNav } from "@/components/layout/MobileNav";
import { GlassCard } from "@/components/layout/GlassCard";
import { Calendar, Users, FileText, Video, ChevronRight, Clock, MessageSquare, User, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, startOfWeek, endOfWeek } from "date-fns";
import { useNavigate } from "react-router-dom";
import { downloadAsCSV } from "@/utils/exportUtils";
import { Download } from "lucide-react";

interface Consultation {
  id: string;
  patientName: string;
  time: string;
  type: string;
  status: string;
  scheduledAt: Date;
}

interface Stats {
  today: number;
  pending: number;
  thisWeek: number;
}

export default function DoctorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayConsultations, setTodayConsultations] = useState<Consultation[]>([]);
  const [stats, setStats] = useState<Stats>({ today: 0, pending: 0, thisWeek: 0 });
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Fetch all consultations for this doctor
      const { data: consultations, error } = await supabase
        .from('consultations')
        .select(`
          id,
          scheduled_at,
          consultation_type,
          status,
          patient_id
        `)
        .eq('doctor_id', user.id)
        .order('scheduled_at', { ascending: true });

      if (error) throw error;

      const now = new Date();
      const weekStart = startOfWeek(now);
      const weekEnd = endOfWeek(now);

      // Calculate stats
      const todayCount = consultations?.filter(c => isToday(new Date(c.scheduled_at))).length || 0;
      const pendingCount = consultations?.filter(c => c.status === 'scheduled' && new Date(c.scheduled_at) >= now).length || 0;
      const weekCount = consultations?.filter(c => {
        const date = new Date(c.scheduled_at);
        return date >= weekStart && date <= weekEnd;
      }).length || 0;

      setStats({ today: todayCount, pending: pendingCount, thisWeek: weekCount });

      // Filter today's consultations
      const todayAppts = consultations?.filter(c => isToday(new Date(c.scheduled_at))) || [];

      if (todayAppts.length > 0) {
        const patientIds = [...new Set(todayAppts.map(c => c.patient_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', patientIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

        setTodayConsultations(todayAppts.map(c => ({
          id: c.id,
          patientName: profileMap.get(c.patient_id) || 'Unknown Patient',
          time: format(new Date(c.scheduled_at), 'h:mm a'),
          type: c.consultation_type,
          status: c.status === 'in_progress' ? 'in-progress' : c.status,
          scheduledAt: new Date(c.scheduled_at)
        })));
      } else {
        setTodayConsultations([]);
      }

      // Fetch unread messages
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('read', false);

      setUnreadMessages(count || 0);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select(`
          id,
          created_at,
          status,
          patient_id
        `)
        .eq('doctor_id', user.id);

      if (error) throw error;

      if (data && data.length > 0) {
        // Fetch patient names
        const patientIds = [...new Set(data.map(p => p.patient_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', patientIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

        const exportData = data.map(rx => ({
          'Patient Name': profileMap.get(rx.patient_id) || 'Unknown',
          'Date': format(new Date(rx.created_at!), 'PPP'),
          'Status': rx.status.replace(/_/g, ' '),
          'Prescription ID': rx.id
        }));

        downloadAsCSV(exportData, 'doctor_prescriptions_report');
      }
    } catch (error) {
      console.error('Export error:', error);
    }
  };


  return (
    <DashboardLayout title={`Hello, Dr. ${user?.fullName?.split(' ').pop()}!`} requiredRole="doctor">
      <div className="space-y-4 sm:space-y-6 pb-24 lg:pb-6">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" />
            Export Data
          </Button>
        </div>
        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-3">
          <GlassCard className="p-3 sm:p-4 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-primary">{stats.today}</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Today</p>
          </GlassCard>
          <GlassCard className="p-3 sm:p-4 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-secondary">{stats.pending}</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Pending</p>
          </GlassCard>
          <GlassCard className="p-3 sm:p-4 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-success">{stats.thisWeek}</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">This Week</p>
          </GlassCard>
        </div>

        {/* Today's Schedule */}
        <GlassCard className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Today's Schedule
            </h3>
            <Button variant="ghost" size="sm" className="text-primary text-xs sm:text-sm" onClick={() => navigate('/doctor/schedule')}>
              Full Schedule <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : todayConsultations.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">No appointments today</p>
          ) : (
            <div className="space-y-3">
              {todayConsultations.map((patient) => (
                <div
                  key={patient.id}
                  className={cn(
                    "flex items-center gap-3 sm:gap-4 p-3 rounded-xl transition-all",
                    patient.status === "in-progress"
                      ? "bg-primary/10 border border-primary/30"
                      : "bg-muted/30"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold">
                      {patient.patientName.split(" ").map(n => n[0]).join("")}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{patient.patientName}</p>
                    <p className="text-xs text-muted-foreground">{patient.time} • {patient.type}</p>
                  </div>
                  {patient.status === "in-progress" ? (
                    <Button size="sm" className="shrink-0">
                      <Video className="w-4 h-4 sm:mr-1" />
                      <span className="hidden sm:inline">Join</span>
                    </Button>
                  ) : (
                    <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <GlassCard hover className="p-4 cursor-pointer" onClick={() => navigate('/doctor/prescriptions')}>
            <div className="p-2.5 sm:p-3 rounded-xl bg-secondary/10 w-fit mb-3">
              <FileText className="w-5 h-5 text-secondary" />
            </div>
            <h3 className="font-semibold text-sm sm:text-base">Write Prescription</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Create new Rx</p>
          </GlassCard>

          <GlassCard hover className="p-4 cursor-pointer" onClick={() => navigate('/doctor/patients')}>
            <div className="p-2.5 sm:p-3 rounded-xl bg-success/10 w-fit mb-3">
              <Users className="w-5 h-5 text-success" />
            </div>
            <h3 className="font-semibold text-sm sm:text-base">Patients</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">View records</p>
          </GlassCard>
        </div>

        {/* Messages Shortcut */}
        <GlassCard hover className="p-4 cursor-pointer" onClick={() => navigate('/doctor/messages')}>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-warning/10">
              <MessageSquare className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Messages</h3>
              <p className="text-sm text-muted-foreground">
                {unreadMessages > 0 ? `${unreadMessages} unread from patients` : 'No unread messages'}
              </p>
            </div>
            {unreadMessages > 0 && (
              <div className="w-6 h-6 rounded-full bg-warning text-warning-foreground text-xs font-bold flex items-center justify-center">
                {unreadMessages}
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      <MobileNav />
    </DashboardLayout>
  );
}
