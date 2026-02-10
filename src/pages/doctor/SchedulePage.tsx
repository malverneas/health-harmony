import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Video, MessageSquare, Clock, User, Loader2, Calendar } from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ChatDialog } from "@/components/messaging/ChatDialog";
import { useToast } from "@/hooks/use-toast";
import { useCall } from "@/contexts/CallContext";

interface Consultation {
  id: string;
  patientId: string;
  patientName: string;
  scheduledAt: Date;
  type: string;
  reason?: string;
  status: string;
}

const CONSULTATION_DURATION_MINUTES = 30;

export default function SchedulePage() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeConsultation, setActiveConsultation] = useState<Consultation | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const { initiateCall } = useCall();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchConsultations();
  }, [user]);

  const fetchConsultations = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('consultations')
        .select(`
          id,
          scheduled_at,
          consultation_type,
          reason,
          status,
          patient_id
        `)
        .eq('doctor_id', user.id)
        .in('status', ['scheduled', 'in_progress'])
        .order('scheduled_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const patientIds = [...new Set(data.map(c => c.patient_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', patientIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

        setConsultations(data.map(c => ({
          id: c.id,
          patientId: c.patient_id,
          patientName: profileMap.get(c.patient_id) || 'Unknown Patient',
          scheduledAt: new Date(c.scheduled_at),
          type: c.consultation_type,
          reason: c.reason,
          status: c.status
        })));
      } else {
        setConsultations([]);
      }
    } catch (error) {
      console.error('Error fetching consultations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, 'EEEE, MMM d');
  };

  const groupedConsultations = consultations.reduce((acc, consultation) => {
    const dateKey = format(consultation.scheduledAt, 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = {
        label: getDateLabel(consultation.scheduledAt),
        items: []
      };
    }
    acc[dateKey].items.push(consultation);
    return acc;
  }, {} as Record<string, { label: string; items: Consultation[] }>);

  const isStartable = (scheduledAt: Date, status: string) => {
    if (status !== 'scheduled') return false;
    // For testing: allow starting any scheduled consultation regardless of time
    return true;
  };

  const notifyPatientOfCall = async (consultation: Consultation) => {
    if (!user) return;
    // Notify the patient via broadcast channel
    const channel = supabase.channel(`incoming-calls-${consultation.patientId}`);
    await channel.subscribe();

    // Fetch doctor name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle();

    await channel.send({
      type: 'broadcast',
      event: 'incoming-call',
      payload: {
        from: user.id,
        to: consultation.patientId,
        callerName: profile?.full_name || 'Your Doctor',
        consultationId: consultation.id,
      }
    });

    supabase.removeChannel(channel);
  };

  const handleStartConsultation = async (consultation: Consultation) => {
    setStartingId(consultation.id);
    try {
      const { error } = await supabase
        .from('consultations')
        .update({ status: 'in_progress' })
        .eq('id', consultation.id);

      if (error) throw error;

      toast({
        title: "Consultation Started",
        description: `You can now ${consultation.type === 'video' ? 'video call' : 'chat with'} ${consultation.patientName}`,
      });

      // Update local state
      setConsultations(prev => prev.map(c =>
        c.id === consultation.id ? { ...c, status: 'in_progress' } : c
      ));

      // Notify patient of incoming call for video consultations
      if (consultation.type === 'video') {
        await notifyPatientOfCall(consultation);
      }

      // Open the chat/video dialog
      if (consultation.type === 'video') {
        initiateCall(consultation.patientId, consultation.patientName, consultation.id);
      } else {
        setActiveConsultation(consultation);
      }
    } catch (error) {
      console.error('Error starting consultation:', error);
      toast({
        title: "Error",
        description: "Failed to start consultation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setStartingId(null);
    }
  };

  const handleJoinConsultation = async (consultation: Consultation) => {
    if (consultation.type === 'video') {
      // Re-notify patient when continuing a video call
      await notifyPatientOfCall(consultation);
      initiateCall(consultation.patientId, consultation.patientName, consultation.id);
    } else {
      setActiveConsultation(consultation);
    }
  };

  return (
    <DashboardLayout requiredRole="doctor">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Schedule</h1>
          <p className="text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM d')}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : consultations.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No upcoming appointments</h3>
            <p className="text-muted-foreground">Your schedule is clear</p>
          </GlassCard>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedConsultations).map(([dateKey, { label, items }]) => (
              <div key={dateKey}>
                <h2 className="text-lg font-semibold mb-3 text-muted-foreground">{label}</h2>
                <div className="space-y-3">
                  {items.map((appt) => (
                    <GlassCard key={appt.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{appt.patientName}</h3>
                            {appt.reason && (
                              <p className="text-sm text-muted-foreground">{appt.reason}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {format(appt.scheduledAt, 'h:mm a')}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {appt.type === "video" && <Video className="w-3 h-3 text-primary" />}
                                {appt.type === "chat" && <MessageSquare className="w-3 h-3 text-primary" />}
                                {appt.type === "physical" && <User className="w-3 h-3 text-primary" />}
                                <span className="text-xs text-muted-foreground capitalize">{appt.type}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {appt.status === 'in_progress' ? (
                            <Button
                              size="sm"
                              onClick={() => handleJoinConsultation(appt)}
                            >
                              {appt.type === 'video' ? <Video className="w-4 h-4 mr-1" /> : <MessageSquare className="w-4 h-4 mr-1" />}
                              Continue
                            </Button>
                          ) : isStartable(appt.scheduledAt, appt.status) ? (
                            <Button
                              size="sm"
                              onClick={() => handleStartConsultation(appt)}
                              disabled={startingId === appt.id}
                            >
                              {startingId === appt.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>Start</>
                              )}
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" disabled>
                              <Clock className="w-4 h-4 mr-1" />
                              Not Yet
                            </Button>
                          )}
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeConsultation && (
          <ChatDialog
            open={!!activeConsultation}
            onOpenChange={(open) => !open && setActiveConsultation(null)}
            recipientId={activeConsultation.patientId}
            recipientName={activeConsultation.patientName}
          />
        )}

      </div>
    </DashboardLayout>
  );
}