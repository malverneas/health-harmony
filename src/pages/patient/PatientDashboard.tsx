import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MobileNav } from "@/components/layout/MobileNav";
import { GlassCard } from "@/components/layout/GlassCard";
import { Calendar, FileText, MessageSquare, Pill, ChevronRight, Video, User, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isTomorrow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { BookConsultationDialog } from "@/components/booking/BookConsultationDialog";
import { useCall } from "@/contexts/CallContext";

interface UpcomingConsultation {
  id: string;
  doctorName: string;
  specialty: string;
  scheduledAt: Date;
  type: string;
  status: string;
}

interface RecentPrescription {
  id: string;
  doctorName: string;
  status: string;
  createdAt: Date;
  medications: string[];
}

export default function PatientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [upcomingConsultation, setUpcomingConsultation] = useState<UpcomingConsultation | null>(null);
  const { initiateCall } = useCall();
  const [recentPrescription, setRecentPrescription] = useState<RecentPrescription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch next upcoming consultation
      const { data: consultations } = await supabase
        .from('consultations')
        .select('id, doctor_id, scheduled_at, consultation_type, status')
        .eq('patient_id', user?.id)
        .in('status', ['scheduled', 'in_progress'])
        .order('scheduled_at', { ascending: true })
        .limit(1);

      if (consultations && consultations.length > 0) {
        const consultation = consultations[0];
        // Fetch doctor profile
        const { data: doctorProfile } = await supabase
          .from('profiles')
          .select('full_name, specialty')
          .eq('user_id', consultation.doctor_id)
          .maybeSingle();

        setUpcomingConsultation({
          id: consultation.id,
          doctorName: doctorProfile?.full_name || 'Unknown Doctor',
          specialty: doctorProfile?.specialty || 'General Medicine',
          scheduledAt: new Date(consultation.scheduled_at),
          type: consultation.consultation_type,
          status: consultation.status
        });
      } else {
        setUpcomingConsultation(null);
      }

      // Fetch most recent prescription
      const { data: prescriptions } = await supabase
        .from('prescriptions')
        .select('id, doctor_id, status, created_at')
        .eq('patient_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (prescriptions && prescriptions.length > 0) {
        const prescription = prescriptions[0];

        // Fetch doctor profile
        const { data: doctorProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', prescription.doctor_id)
          .maybeSingle();

        // Fetch prescription items
        const { data: items } = await supabase
          .from('prescription_items')
          .select('medication_name')
          .eq('prescription_id', prescription.id);

        setRecentPrescription({
          id: prescription.id,
          doctorName: doctorProfile?.full_name || 'Unknown Doctor',
          status: formatStatus(prescription.status),
          createdAt: new Date(prescription.created_at || ''),
          medications: items?.map(i => i.medication_name) || [],
        });
      } else {
        setRecentPrescription(null);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      'sent': 'Sent to pharmacy',
      'acknowledged': 'Being processed',
      'in_stock': 'Ready to choose pickup/delivery',
      'preparing': 'Preparing',
      'ready': 'Ready for pickup',
      'delivered': 'Delivered',
    };
    return statusMap[status] || status;
  };

  const formatDate = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d');
  };

  const getConsultationIcon = (type: string) => {
    switch (type) {
      case 'video': return Video;
      case 'chat': return MessageSquare;
      default: return User;
    }
  };

  return (
    <DashboardLayout title={`Hi, ${user?.fullName?.split(' ')[0] || 'there'}!`} requiredRole="patient">
      <div className="space-y-4 sm:space-y-6 pb-24 lg:pb-6">
        {/* Primary Action - Book Consultation */}
        <GlassCard className="p-4 sm:p-6 bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-display font-semibold">Book a Consultation</h2>
              <p className="text-sm text-muted-foreground mt-1">Schedule a visit with a doctor</p>
            </div>
            <Button className="w-full sm:w-auto" size="lg" onClick={() => setBookingOpen(true)}>
              <Calendar className="w-4 h-4 mr-2" />
              Book Now
            </Button>
          </div>
        </GlassCard>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Upcoming Consultation */}
            {upcomingConsultation ? (
              <GlassCard className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-muted-foreground text-sm">Next Appointment</h3>
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                    {upcomingConsultation.type === "video" ? "Video Call" :
                      upcomingConsultation.type === "chat" ? "Chat" : "In-Person"}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    {(() => {
                      const Icon = getConsultationIcon(upcomingConsultation.type);
                      return <Icon className="w-5 h-5 text-primary" />;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{upcomingConsultation.doctorName}</p>
                    <p className="text-sm text-muted-foreground">{upcomingConsultation.specialty}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-medium text-primary">{formatDate(upcomingConsultation.scheduledAt)}</p>
                    <p className="text-sm text-muted-foreground">{format(upcomingConsultation.scheduledAt, 'h:mm a')}</p>
                  </div>
                </div>
                {upcomingConsultation.status === 'in_progress' && upcomingConsultation.type === 'video' && (
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() => initiateCall(upcomingConsultation.id, upcomingConsultation.doctorName, upcomingConsultation.id)}
                  >
                    <Video className="w-4 h-4 mr-2" />
                    Join Consultation
                  </Button>
                )}
              </GlassCard>
            ) : (
              <GlassCard className="p-4 sm:p-5">
                <p className="text-center text-muted-foreground py-4">No upcoming consultations</p>
                <Button variant="outline" className="w-full" onClick={() => setBookingOpen(true)}>
                  Book your first consultation
                </Button>
              </GlassCard>
            )}
          </>
        )}

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <GlassCard hover className="p-4 cursor-pointer" onClick={() => navigate('/patient/prescriptions')}>
            <div className="p-2.5 sm:p-3 rounded-xl bg-secondary/10 w-fit mb-3">
              <FileText className="w-5 h-5 text-secondary" />
            </div>
            <h3 className="font-semibold text-sm sm:text-base">Prescriptions</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">View your medications</p>
          </GlassCard>

          <GlassCard hover className="p-4 cursor-pointer" onClick={() => navigate('/patient/orders')}>
            <div className="p-2.5 sm:p-3 rounded-xl bg-success/10 w-fit mb-3">
              <Pill className="w-5 h-5 text-success" />
            </div>
            <h3 className="font-semibold text-sm sm:text-base">Orders</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Track your orders</p>
          </GlassCard>
        </div>

        {/* Recent Prescription */}
        {!isLoading && (
          <GlassCard className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Recent Prescription</h3>
              <Button variant="ghost" size="sm" className="text-primary text-xs sm:text-sm" onClick={() => navigate('/patient/prescriptions')}>
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            {recentPrescription ? (
              <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/30">
                <div className="p-2 rounded-lg bg-success/10">
                  <Pill className="w-5 h-5 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {recentPrescription.medications.length > 0
                      ? recentPrescription.medications[0]
                      : 'Prescription'}
                    {recentPrescription.medications.length > 1 && ` +${recentPrescription.medications.length - 1} more`}
                  </p>
                  <p className="text-sm text-muted-foreground">{recentPrescription.doctorName}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-success/10 text-success shrink-0">
                  {recentPrescription.status}
                </span>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">No prescriptions yet</p>
            )}
          </GlassCard>
        )}

        {/* Messages Shortcut */}
        <GlassCard hover className="p-4 cursor-pointer" onClick={() => navigate('/patient/messages')}>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-warning/10">
              <MessageSquare className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Messages</h3>
              <p className="text-sm text-muted-foreground">Chat with your doctor or pharmacy</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </GlassCard>
      </div>

      <MobileNav />

      <BookConsultationDialog
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        onSuccess={fetchDashboardData}
      />
    </DashboardLayout>
  );
}
