import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, User, Stethoscope } from "lucide-react";

const conversations = [
  { id: 1, name: "John Smith", type: "patient", lastMessage: "When can I pick up?", time: "10m ago", unread: 1 },
  { id: 2, name: "Dr. Sarah Wilson", type: "doctor", lastMessage: "Please dispense as prescribed", time: "1h ago", unread: 0 },
  { id: 3, name: "Emma Johnson", type: "patient", lastMessage: "Is my order ready?", time: "3h ago", unread: 2 },
];

export default function PharmacyMessagesPage() {
  return (
    <DashboardLayout requiredRole="pharmacist">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Messages</h1>

        <div className="space-y-2">
          {conversations.map((convo) => (
            <GlassCard key={convo.id} className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
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
                      {convo.lastMessage}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{convo.time}</p>
                  {convo.unread > 0 && (
                    <Badge className="mt-1 bg-primary text-primary-foreground">{convo.unread}</Badge>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
