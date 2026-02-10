import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { Video, Phone, MessageSquare, MapPin, Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface Consultation {
  id: string;
  doctorName?: string;
  patientName?: string;
  specialty?: string;
  type: "video" | "voice" | "chat" | "physical";
  time: string;
  date: string;
  status: "upcoming" | "in-progress" | "completed";
}

const mockConsultations: Consultation[] = [
  {
    id: "1",
    doctorName: "Dr. Sarah Wilson",
    specialty: "Cardiologist",
    type: "video",
    time: "10:00 AM",
    date: "Today",
    status: "upcoming",
  },
  {
    id: "2",
    doctorName: "Dr. Michael Chen",
    specialty: "General Physician",
    type: "physical",
    time: "2:30 PM",
    date: "Tomorrow",
    status: "upcoming",
  },
  {
    id: "3",
    doctorName: "Dr. Emily Brown",
    specialty: "Dermatologist",
    type: "chat",
    time: "4:00 PM",
    date: "Dec 18",
    status: "upcoming",
  },
];

const typeIcons = {
  video: Video,
  voice: Phone,
  chat: MessageSquare,
  physical: MapPin,
};

const typeColors = {
  video: "text-primary bg-primary/10",
  voice: "text-secondary bg-secondary/10",
  chat: "text-success bg-success/10",
  physical: "text-warning bg-warning/10",
};

interface UpcomingConsultationsProps {
  showDoctor?: boolean;
  showPatient?: boolean;
}

export function UpcomingConsultations({ showDoctor = true, showPatient = false }: UpcomingConsultationsProps) {
  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-display font-semibold">Upcoming Consultations</h2>
        <Button variant="ghost" size="sm" className="text-primary">
          View All
        </Button>
      </div>

      <div className="space-y-4">
        {mockConsultations.map((consultation, index) => {
          const Icon = typeIcons[consultation.type];
          return (
            <div 
              key={consultation.id}
              className={cn(
                "flex items-center gap-4 p-4 rounded-xl bg-muted/30 transition-all hover:bg-muted/50",
                "animate-slide-up"
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={cn("p-3 rounded-xl", typeColors[consultation.type])}>
                <Icon className="w-5 h-5" />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {showDoctor ? consultation.doctorName : consultation.patientName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {consultation.specialty}
                </p>
              </div>

              <div className="text-right">
                <div className="flex items-center gap-1 text-sm font-medium">
                  <Clock className="w-3 h-3" />
                  {consultation.time}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  {consultation.date}
                </div>
              </div>

              <Button size="sm" variant="neon" className="hidden sm:flex">
                Join
              </Button>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
