import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Loader2, User, Stethoscope, Pill } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChatDialog } from "@/components/messaging/ChatDialog";

interface Contact {
  id: string;
  fullName: string;
  role: 'doctor' | 'pharmacist';
  specialty?: string;
  pharmacyName?: string;
  unreadCount: number;
  lastMessage?: string;
}

export default function MessagesPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchContacts();

      const channel = supabase
        .channel('patient-messages')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages' },
          () => {
            fetchContacts();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchContacts = async () => {
    setIsLoading(true);
    try {
      // Get all doctors
      const { data: doctorRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'doctor');

      // Get all pharmacists
      const { data: pharmacistRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'pharmacist');

      const doctorIds = doctorRoles?.map(r => r.user_id) || [];
      const pharmacistIds = pharmacistRoles?.map(r => r.user_id) || [];
      const allIds = [...doctorIds, ...pharmacistIds];

      if (allIds.length > 0 && user) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, specialty')
          .in('user_id', allIds);

        // Fetch pharmacy names for pharmacists
        let pharmacyMap = new Map<string, string>();
        if (pharmacistIds.length > 0) {
          const { data: pharmacies } = await supabase
            .from('pharmacies')
            .select('user_id, name')
            .in('user_id', pharmacistIds);

          pharmacyMap = new Map(pharmacies?.map(p => [p.user_id, p.name]) || []);
        }

        if (profiles) {
          const doctorIdSet = new Set(doctorIds);
          const contactsWithMessages = await Promise.all(
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

              const isDoctor = doctorIdSet.has(p.user_id);

              return {
                id: p.user_id,
                fullName: p.full_name,
                role: isDoctor ? 'doctor' as const : 'pharmacist' as const,
                specialty: isDoctor ? p.specialty || '' : undefined,
                pharmacyName: !isDoctor ? pharmacyMap.get(p.user_id) : undefined,
                unreadCount: count || 0,
                lastMessage: lastMsg?.content,
              };
            })
          );

          setContacts(contactsWithMessages);
        }
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
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
        ) : contacts.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No contacts available</h3>
            <p className="text-muted-foreground">There are no doctors or pharmacies to chat with at the moment</p>
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {contacts.map((contact) => (
              <GlassCard
                key={contact.id}
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedContact(contact)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${contact.role === 'doctor' ? 'bg-primary/20' : 'bg-green-500/20'
                      }`}>
                      {contact.role === 'doctor' ? (
                        <Stethoscope className="w-5 h-5 text-primary" />
                      ) : (
                        <Pill className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{contact.fullName}</h3>
                        <Badge className={
                          contact.role === 'doctor'
                            ? 'bg-purple-500/20 text-purple-500'
                            : 'bg-green-500/20 text-green-500'
                        }>
                          {contact.role === 'doctor' ? 'Doctor' : 'Pharmacy'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-[300px]">
                        {contact.lastMessage || contact.specialty || contact.pharmacyName || 'Start a conversation'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {contact.unreadCount > 0 && (
                      <Badge className="bg-primary text-primary-foreground">{contact.unreadCount}</Badge>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {selectedContact && (
        <ChatDialog
          open={!!selectedContact}
          onOpenChange={(open) => !open && setSelectedContact(null)}
          recipientId={selectedContact.id}
          recipientName={selectedContact.fullName}
        />
      )}
    </DashboardLayout>
  );
}
