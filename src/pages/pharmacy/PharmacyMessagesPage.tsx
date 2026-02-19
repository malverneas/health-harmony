import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, User, Stethoscope, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChatDialog } from "@/components/messaging/ChatDialog";

interface Conversation {
  id: string;
  name: string;
  type: 'patient' | 'doctor' | 'admin';
  lastMessage?: string;
  unreadCount: number;
}

export default function PharmacyMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchConversations();

      const channel = supabase
        .channel('pharmacy-messages')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages' },
          () => {
            fetchConversations();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Get all users the pharmacy has exchanged messages with
      const { data: sentMessages } = await supabase
        .from('messages')
        .select('recipient_id')
        .eq('sender_id', user.id);

      const { data: receivedMessages } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('recipient_id', user.id);

      const contactIds = new Set<string>();
      sentMessages?.forEach(m => contactIds.add(m.recipient_id));
      receivedMessages?.forEach(m => contactIds.add(m.sender_id));

      if (contactIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', Array.from(contactIds));

        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', Array.from(contactIds));

        if (profiles && roles) {
          const roleMap = new Map(roles.map(r => [r.user_id, r.role]));

          const convos = await Promise.all(
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
                name: p.full_name,
                type: (roleMap.get(p.user_id) || 'patient') as 'patient' | 'doctor' | 'admin',
                unreadCount: count || 0,
                lastMessage: lastMsg?.content,
              };
            })
          );
          setConversations(convos);
        }
      }
    } catch (error) {
      console.error('Error fetching pharmacy conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout requiredRole="pharmacist">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Messages</h1>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : conversations.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No conversations</h3>
            <p className="text-muted-foreground">You don't have any messages yet</p>
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {conversations.map((convo) => (
              <GlassCard
                key={convo.id}
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedConvo(convo)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      {convo.type === "patient" ? (
                        <User className="w-5 h-5 text-primary" />
                      ) : (
                        <Stethoscope className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{convo.name}</h3>
                        <span className="text-xs text-muted-foreground capitalize">({convo.type})</span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-[300px]">
                        {convo.lastMessage || 'No messages yet'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {convo.unreadCount > 0 && (
                      <Badge className="bg-primary text-primary-foreground">{convo.unreadCount}</Badge>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {selectedConvo && (
        <ChatDialog
          open={!!selectedConvo}
          onOpenChange={(open) => !open && setSelectedConvo(null)}
          recipientId={selectedConvo.id}
          recipientName={selectedConvo.name}
        />
      )}
    </DashboardLayout>
  );
}
