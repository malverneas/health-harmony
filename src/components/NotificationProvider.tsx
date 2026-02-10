import { useMessageNotifications } from "@/hooks/useMessageNotifications";
import { useConsultationNotifications } from "@/hooks/useConsultationNotifications";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  useMessageNotifications();
  useConsultationNotifications();
  return <>{children}</>;
}
