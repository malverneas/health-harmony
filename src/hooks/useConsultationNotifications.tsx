import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

export function useConsultationNotifications() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Preload notification sound
        audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
    }, []);

    useEffect(() => {
        if (!user || user.role !== 'doctor') return;

        const channel = supabase
            .channel(`doctor-notifications-${user.id}`)
            .on(
                "broadcast",
                { event: "new-booking" },
                (payload) => {
                    const { patientName, scheduledAt, type } = payload.payload;

                    // Play sound
                    if (audioRef.current) {
                        audioRef.current.play().catch(e => console.error("Error playing notification sound:", e));
                    }

                    toast.success("New Booking!", {
                        description: `${patientName} booked a ${type} consultation for ${format(new Date(scheduledAt), 'PPp')}`,
                        action: {
                            label: "View Schedule",
                            onClick: () => navigate("/doctor/schedule"),
                        },
                        duration: 10000,
                    });

                    // Show browser push notification if permitted
                    if ("Notification" in window && Notification.permission === "granted") {
                        const notification = new Notification("New Booking!", {
                            body: `${patientName} booked a ${type} consultation for ${format(new Date(scheduledAt), 'PPp')}`,
                            icon: "/favicon.ico",
                        });

                        notification.onclick = () => {
                            window.focus();
                            navigate("/doctor/schedule");
                            notification.close();
                        };
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);
}
