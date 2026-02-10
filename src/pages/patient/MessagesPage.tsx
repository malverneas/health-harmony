import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Loader2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChatDialog } from "@/components/messaging/ChatDialog";

interface Doctor {
  id: string;
  fullName: string;
  specialty: string;
  unreadCount: number;
  lastMessage?: string;
}

export default function MessagesPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchDoctorsWithMessages();

      // Subscribe to new messages
      const channel = supabase
        .channel('patient-messages')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          () => {
            fetchDoctorsWithMessages();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchDoctorsWithMessages = async () => {
    setIsLoading(true);
    try {
      // Get all doctors
      const { data: doctorRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'doctor');

      if (doctorRoles && doctorRoles.length > 0) {
        const doctorIds = doctorRoles.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, specialty')
          .in('user_id', doctorIds);

        if (profiles && user) {
          // Get unread counts and last messages for each doctor
          const doctorsWithMessages = await Promise.all(
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
                specialty: p.specialty || 'General Medicine',
                unreadCount: count || 0,
                lastMessage: lastMsg?.content,
              };
            })
          );

          setDoctors(doctorsWithMessages);
        }
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout requiredRole="patient">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Messages</h1>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : doctors.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No doctors available</h3>
            <p className="text-muted-foreground">There are no doctors to chat with at the moment</p>
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {doctors.map((doctor) => (
              <GlassCard
                key={doctor.id}
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedDoctor(doctor)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{doctor.fullName}</h3>
                      <p className="text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-[300px]">
                        {doctor.lastMessage || doctor.specialty}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {doctor.unreadCount > 0 && (
                      <Badge className="bg-primary text-primary-foreground">{doctor.unreadCount}</Badge>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {selectedDoctor && (
        <ChatDialog
          open={!!selectedDoctor}
          onOpenChange={(open) => !open && setSelectedDoctor(null)}
          recipientId={selectedDoctor.id}
          recipientName={selectedDoctor.fullName}
        />
      )}
    </DashboardLayout>
  );
}
