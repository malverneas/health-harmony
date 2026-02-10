import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Video, MessageSquare, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface BookConsultationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface Doctor {
  id: string;
  fullName: string;
  specialty: string;
}

interface BookedSlot {
  date: string;
  time: string;
}

const consultationTypes = [
  { id: "video", label: "Video Call", icon: Video },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "physical", label: "In-Person", icon: User },
];

const timeSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"
];

export function BookConsultationDialog({ open, onOpenChange, onSuccess }: BookConsultationDialogProps) {
  const [step, setStep] = useState(1);
  const [consultationType, setConsultationType] = useState("video");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [reason, setReason] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchDoctors();
    }
  }, [open]);

  useEffect(() => {
    if (selectedDoctor) {
      fetchBookedSlots();
    }
  }, [selectedDoctor]);

  const fetchDoctors = async () => {
    setIsFetching(true);
    try {
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

        if (profiles) {
          setDoctors(profiles.map(p => ({
            id: p.user_id,
            fullName: p.full_name,
            specialty: p.specialty || 'General Medicine'
          })));
        }
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    } finally {
      setIsFetching(false);
    }
  };

  const fetchBookedSlots = async () => {
    if (!selectedDoctor) return;

    try {
      const { data } = await supabase
        .from('consultations')
        .select('scheduled_at')
        .eq('doctor_id', selectedDoctor)
        .in('status', ['scheduled', 'in_progress']);

      if (data) {
        setBookedSlots(data.map(c => ({
          date: format(new Date(c.scheduled_at), 'yyyy-MM-dd'),
          time: format(new Date(c.scheduled_at), 'HH:mm')
        })));
      }
    } catch (error) {
      console.error('Error fetching booked slots:', error);
    }
  };

  const isSlotBooked = (time: string) => {
    if (!selectedDate) return false;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return bookedSlots.some(slot => slot.date === dateStr && slot.time === time);
  };

  const isSlotPast = (time: string) => {
    if (!selectedDate) return false;
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const selectedStr = format(selectedDate, 'yyyy-MM-dd');
    if (selectedStr !== todayStr) return false;

    const [hours, minutes] = time.split(':').map(Number);
    const slotTime = new Date(selectedDate);
    slotTime.setHours(hours, minutes, 0, 0);
    return slotTime <= now;
  };

  const isSlotDisabled = (time: string) => {
    return isSlotBooked(time) || isSlotPast(time);
  };

  const handleBook = async () => {
    if (!user || !selectedDoctor || !selectedDate || !selectedTime) return;

    setIsLoading(true);
    try {
      const scheduledAt = new Date(selectedDate);
      const [hours, minutes] = selectedTime.split(':');
      scheduledAt.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const { error } = await supabase.from('consultations').insert({
        patient_id: user.id,
        doctor_id: selectedDoctor,
        consultation_type: consultationType,
        scheduled_at: scheduledAt.toISOString(),
        reason,
        status: 'scheduled'
      });

      if (error) throw error;

      // Broadcast to doctor
      const channel = supabase.channel(`doctor-notifications-${selectedDoctor}`);
      await channel.subscribe();
      await channel.send({
        type: 'broadcast',
        event: 'new-booking',
        payload: {
          patientName: user.fullName || 'A patient',
          scheduledAt: scheduledAt.toISOString(),
          type: consultationType
        }
      });
      supabase.removeChannel(channel);

      toast({
        title: "Consultation Booked!",
        description: `Your ${consultationType} consultation is scheduled for ${format(scheduledAt, 'PPp')}`,
      });

      onOpenChange(false);
      onSuccess?.();
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to book consultation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setConsultationType("video");
    setSelectedDate(undefined);
    setSelectedTime("");
    setSelectedDoctor("");
    setReason("");
    setBookedSlots([]);
  };

  const canProceed = () => {
    if (step === 1) return !!consultationType;
    if (step === 2) return !!selectedDoctor;
    if (step === 3) return !!selectedDate && !!selectedTime;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] glass-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Book Consultation</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={cn(
                "flex-1 h-1 rounded-full transition-colors",
                s <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-muted-foreground">Select consultation type</p>
            <div className="grid grid-cols-3 gap-3">
              {consultationTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setConsultationType(type.id)}
                  className={cn(
                    "p-4 rounded-xl border transition-all text-center",
                    consultationType === type.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-muted/30 hover:border-primary/50"
                  )}
                >
                  <type.icon className={cn(
                    "w-6 h-6 mx-auto mb-2",
                    consultationType === type.id ? "text-primary" : "text-muted-foreground"
                  )} />
                  <p className="text-sm font-medium">{type.label}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-muted-foreground">Select a doctor</p>
            {isFetching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : doctors.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No doctors available</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {doctors.map((doctor) => (
                  <button
                    key={doctor.id}
                    onClick={() => setSelectedDoctor(doctor.id)}
                    className={cn(
                      "w-full p-4 rounded-xl border transition-all text-left flex items-center gap-3",
                      selectedDoctor === doctor.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted/30 hover:border-primary/50"
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{doctor.fullName}</p>
                      <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-muted-foreground">Select date and time</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  setSelectedDate(date);
                  setSelectedTime("");
                }}
                disabled={(date) => date < new Date() || date.getDay() === 0}
                className="rounded-xl border border-border"
              />
              <div className="grid grid-cols-3 gap-2 content-start">
                {timeSlots.map((time) => {
                  const disabled = isSlotDisabled(time);
                  const booked = isSlotBooked(time);
                  return (
                    <button
                      key={time}
                      onClick={() => !disabled && setSelectedTime(time)}
                      disabled={disabled}
                      className={cn(
                        "p-2 rounded-lg border text-sm transition-all",
                        disabled
                          ? "border-destructive/30 bg-destructive/10 text-muted-foreground cursor-not-allowed line-through"
                          : selectedTime === time
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-muted/30 hover:border-primary/50"
                      )}
                      title={booked ? "Already booked" : isSlotPast(time) ? "Time has passed" : undefined}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            </div>
            {selectedDate && (
              <p className="text-xs text-muted-foreground">
                Slots marked with strikethrough are already booked
              </p>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-muted-foreground">Additional details (optional)</p>
            <Textarea
              placeholder="Describe your symptoms or reason for consultation..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
            <div className="p-4 rounded-xl bg-muted/30 border border-border">
              <h4 className="font-medium mb-2">Booking Summary</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Type: {consultationTypes.find(t => t.id === consultationType)?.label}</p>
                <p>Doctor: {doctors.find(d => d.id === selectedDoctor)?.fullName}</p>
                {selectedDate && selectedTime && (
                  <p>Date: {format(selectedDate, 'PPP')} at {selectedTime}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button
            className="flex-1"
            onClick={() => step < 4 ? setStep(step + 1) : handleBook()}
            disabled={!canProceed() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : step < 4 ? (
              "Continue"
            ) : (
              "Book Consultation"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
