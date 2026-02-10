import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { BookConsultationDialog } from "@/components/booking/BookConsultationDialog";
import { ChatDialog } from "@/components/messaging/ChatDialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Video, MessageSquare, Clock, User, Loader2, X } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCall } from "@/contexts/CallContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Consultation {
  id: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  scheduledAt: Date;
  type: string;
  status: string;
  reason?: string;
}

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500/20 text-blue-400",
  in_progress: "bg-yellow-500/20 text-yellow-400",
  completed: "bg-green-500/20 text-green-400",
  cancelled: "bg-red-500/20 text-red-400",
};

const CONSULTATION_DURATION_MINUTES = 30;

export default function ConsultationsPage() {
  const [showBookDialog, setShowBookDialog] = useState(false);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<Consultation | null>(null);
  const { initiateCall } = useCall();
  const { user } = useAuth();
  const { toast } = useToast();

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
          status,
          reason,
          doctor_id
        `)
        .eq('patient_id', user.id)
        .order('scheduled_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const doctorIds = [...new Set(data.map(c => c.doctor_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, specialty')
          .in('user_id', doctorIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        setConsultations(data.map(c => ({
          id: c.id,
          doctorId: c.doctor_id,
          doctorName: profileMap.get(c.doctor_id)?.full_name || 'Unknown Doctor',
          specialty: profileMap.get(c.doctor_id)?.specialty || 'General Medicine',
          scheduledAt: new Date(c.scheduled_at),
          type: c.consultation_type,
          status: c.status,
          reason: c.reason
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

  useEffect(() => {
    fetchConsultations();
  }, [user]);

  const isUpcoming = (date: Date) => new Date(date) > new Date();

  const handleCancelClick = (id: string) => {
    setSelectedConsultation(id);
    setShowCancelDialog(true);
  };

  const handleCancelConfirm = async () => {
    if (!selectedConsultation) return;

    setCancellingId(selectedConsultation);
    try {
      const { error } = await supabase
        .from('consultations')
        .delete()
        .eq('id', selectedConsultation);

      if (error) throw error;

      toast({
        title: "Consultation Cancelled",
        description: "Your consultation has been cancelled successfully.",
      });

      fetchConsultations();
    } catch (error) {
      console.error('Error cancelling consultation:', error);
      toast({
        title: "Error",
        description: "Failed to cancel consultation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCancellingId(null);
      setShowCancelDialog(false);
      setSelectedConsultation(null);
    }
  };

  return (
    <DashboardLayout requiredRole="patient">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Consultations</h1>
          <Button className="gap-2" onClick={() => setShowBookDialog(true)}>
            <Calendar className="w-4 h-4" />
            Book New
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : consultations.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No consultations yet</h3>
            <p className="text-muted-foreground mb-4">Book your first consultation with a doctor</p>
            <Button onClick={() => setShowBookDialog(true)}>Book Consultation</Button>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {consultations.map((consultation) => (
              <GlassCard key={consultation.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      {consultation.type === "video" ? (
                        <Video className="w-5 h-5 text-primary" />
                      ) : consultation.type === "chat" ? (
                        <MessageSquare className="w-5 h-5 text-primary" />
                      ) : (
                        <User className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold">{consultation.doctorName}</h3>
                      <p className="text-sm text-muted-foreground">{consultation.specialty}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {format(consultation.scheduledAt, 'PPp')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={statusColors[consultation.status]}>
                      {consultation.status.replace('_', ' ')}
                    </Badge>
                    {(isUpcoming(consultation.scheduledAt) || consultation.status === 'in_progress') &&
                      (consultation.status === 'scheduled' || consultation.status === 'in_progress') && (
                        <>
                          {consultation.status === 'in_progress' && consultation.type === 'chat' && (
                            <Button size="sm" onClick={() => setActiveChat(consultation)}>
                              <MessageSquare className="w-4 h-4 mr-1" />
                              Chat
                            </Button>
                          )}
                          {consultation.status === 'scheduled' && (
                            <Button size="sm" disabled variant="outline">
                              Awaiting Doctor
                            </Button>
                          )}
                          {consultation.status === 'in_progress' && consultation.type === 'video' && (
                            <Button size="sm" onClick={() => initiateCall(consultation.doctorId, consultation.doctorName, consultation.id)}>
                              <Video className="w-4 h-4 mr-1" />
                              Join Call
                            </Button>
                          )}
                          {consultation.status === 'scheduled' && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleCancelClick(consultation.id)}
                              disabled={cancellingId === consultation.id}
                            >
                              {cancellingId === consultation.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </>
                      )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        <BookConsultationDialog
          open={showBookDialog}
          onOpenChange={setShowBookDialog}
          onSuccess={fetchConsultations}
        />

        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Consultation</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel this consultation? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Appointment</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Cancel Consultation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Chat Dialog */}
        {activeChat && (
          <ChatDialog
            open={!!activeChat}
            onOpenChange={(open) => !open && setActiveChat(null)}
            recipientId={activeChat.doctorId}
            recipientName={activeChat.doctorName}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
