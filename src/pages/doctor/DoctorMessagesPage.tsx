import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Loader2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChatDialog } from "@/components/messaging/ChatDialog";

interface Patient {
  id: string;
  fullName: string;
  unreadCount: number;
  lastMessage?: string;
}

export default function DoctorMessagesPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchPatientsWithMessages();

      // Subscribe to new messages
      const channel = supabase
        .channel('doctor-messages')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          () => {
            fetchPatientsWithMessages();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchPatientsWithMessages = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Get unique patient IDs from consultations and messages
      const { data: consultations } = await supabase
        .from('consultations')
        .select('patient_id')
        .eq('doctor_id', user.id);

      const { data: sentMessages } = await supabase
        .from('messages')
        .select('recipient_id')
        .eq('sender_id', user.id);

      const { data: receivedMessages } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('recipient_id', user.id);

      // Collect unique patient IDs
      const patientIds = new Set<string>();
      consultations?.forEach(c => patientIds.add(c.patient_id));
      sentMessages?.forEach(m => patientIds.add(m.recipient_id));
      receivedMessages?.forEach(m => patientIds.add(m.sender_id));

      if (patientIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', Array.from(patientIds));

        if (profiles) {
          const patientsWithMessages = await Promise.all(
            profiles.map(async (p) => {
              const { count } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('sender_id', p.user_id)
                .eq('recipient_id', user.id)
                .eq('read', false);

              const { data: lastMsg } = await supabase
                .from('messages')
                .select('content')
                .or(`and(sender_id.eq.${user.id},recipient_id.eq.${p.user_id}),and(sender_id.eq.${p.user_id},recipient_id.eq.${user.id})`)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

              return {
                id: p.user_id,
                fullName: p.full_name,
                unreadCount: count || 0,
                lastMessage: lastMsg?.content,
              };
            })
          );

          setPatients(patientsWithMessages);
        }
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout requiredRole="doctor">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Messages</h1>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : patients.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No conversations</h3>
            <p className="text-muted-foreground">You don't have any patient conversations yet</p>
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {patients.map((patient) => (
              <GlassCard
                key={patient.id}
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedPatient(patient)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{patient.fullName}</h3>
                      <p className="text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-[300px]">
                        {patient.lastMessage || 'No messages yet'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {patient.unreadCount > 0 && (
                      <Badge className="bg-primary text-primary-foreground">{patient.unreadCount}</Badge>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {selectedPatient && (
        <ChatDialog
          open={!!selectedPatient}
          onOpenChange={(open) => !open && setSelectedPatient(null)}
          recipientId={selectedPatient.id}
          recipientName={selectedPatient.fullName}
        />
      )}
    </DashboardLayout>
  );
}
