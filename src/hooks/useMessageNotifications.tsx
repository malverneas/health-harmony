import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useMessageNotifications() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const notificationPermissionRef = useRef<NotificationPermission>("default");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Preload notification sound
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission().then((permission) => {
        notificationPermissionRef.current = permission;
      });
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("message-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload) => {
          const newMessage = payload.new as {
            id: string;
            sender_id: string;
            content: string;
            created_at: string;
          };

          // Check if user is on the messages page
          const isOnMessagesPage = location.pathname.includes("/messages");

          if (!isOnMessagesPage) {
            // Fetch sender's name
            const { data: senderProfile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("user_id", newMessage.sender_id)
              .single();

            const senderName = senderProfile?.full_name || "Someone";
            const messagePreview = newMessage.content.length > 50
              ? newMessage.content.substring(0, 50) + "..."
              : newMessage.content;

            // Play sound
            if (audioRef.current) {
              audioRef.current.play().catch(e => console.error("Error playing notification sound:", e));
            }

            const messagesPath = user.role === "patient"
              ? "/patient/messages"
              : user.role === "doctor"
                ? "/doctor/messages"
                : "/pharmacy/messages";

            // Show toast notification
            const isSystemUpdate = newMessage.content.startsWith('[');
            const title = isSystemUpdate
              ? newMessage.content.split(']')[0].substring(1)
              : `New message from ${senderName}`;

            const displayContent = isSystemUpdate
              ? newMessage.content.split(']')[1].trim()
              : newMessage.content;

            if (isSystemUpdate) {
              toast.success(title, {
                description: displayContent,
                action: {
                  label: "View",
                  onClick: () => navigate(messagesPath)
                },
              });
            } else {
              toast.info(title, {
                description: messagePreview,
                action: {
                  label: "View",
                  onClick: () => navigate(messagesPath)
                },
              });
            }

            // Show browser push notification if permitted
            if ("Notification" in window && notificationPermissionRef.current === "granted") {
              const notification = new Notification(`New message from ${senderName}`, {
                body: messagePreview,
                icon: "/favicon.ico",
                tag: `message-${newMessage.id}`,
              });

              notification.onclick = () => {
                window.focus();
                navigate(messagesPath);
                notification.close();
              };
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, user?.role, location.pathname]);
}
