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
                    const { patientName, scheduledAt, type, vitals } = payload.payload;
                    
                    // Check for high vitals
                    const alerts: string[] = [];
                    if (vitals) {
                        const temp = parseFloat(vitals.temperature);
                        if (!isNaN(temp) && temp >= 38) alerts.push(`High Temp: ${vitals.temperature}°C`);
                        
                        if (vitals.bloodPressure?.includes('/')) {
                            const [sys, dia] = vitals.bloodPressure.split('/').map((v: string) => parseInt(v.trim()));
                            if (sys >= 140 || dia >= 90) alerts.push(`High BP: ${vitals.bloodPressure}`);
                        }
                        
                        const sugar = parseFloat(vitals.sugarLevel);
                        if (!isNaN(sugar) && sugar > 10) alerts.push(`High Sugar: ${vitals.sugarLevel} mmol/L`);
                    }

                    // Play sound
                    if (audioRef.current) {
                        audioRef.current.play().catch(e => console.error("Error playing notification sound:", e));
                    }

                    if (alerts.length > 0) {
                        // High vitals alert - Use a more urgent toast
                        toast.error(`🚨 URGENT: High Vitals!`, {
                            description: `${patientName} has ${alerts.join(", ")}. Booked for ${format(new Date(scheduledAt), 'PPp')}`,
                            action: {
                                label: "Review Now",
                                onClick: () => navigate("/doctor/schedule"),
                            },
                            duration: 15000,
                        });
                    } else {
                        // Normal booking
                        toast.success("New Booking!", {
                            description: `${patientName} booked a ${type} consultation for ${format(new Date(scheduledAt), 'PPp')}`,
                            action: {
                                label: "View Schedule",
                                onClick: () => navigate("/doctor/schedule"),
                            },
                            duration: 10000,
                        });
                    }

                    // Show browser push notification
                    const hasAlerts = alerts.length > 0;
                    if ("Notification" in window && Notification.permission === "granted") {
                        const notification = new Notification(
                            hasAlerts ? "🚨 HIGH VITALS ALERT!" : "New Booking!", 
                            {
                                body: hasAlerts 
                                    ? `${patientName} has concerning vitals: ${alerts.join(", ")}`
                                    : `${patientName} booked a ${type} consultation for ${format(new Date(scheduledAt), 'PPp')}`,
                                icon: "/favicon.ico",
                            }
                        );

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
