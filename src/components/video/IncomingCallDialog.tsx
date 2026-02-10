import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Video } from "lucide-react";

interface IncomingCallDialogProps {
  onAnswer: () => void;
  onDecline: () => void;
  callerName: string;
}

export function IncomingCallDialog({ onAnswer, onDecline, callerName }: IncomingCallDialogProps) {
  return (
    <Dialog open={true} onOpenChange={(open) => !open && onDecline()}>
      <DialogContent className="sm:max-w-[400px] text-center">
        <div className="flex flex-col items-center gap-6 py-6">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
            <Video className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Incoming Video Call</h2>
            <p className="text-muted-foreground mt-1">
              Dr. {callerName} is calling you
            </p>
          </div>
          <div className="flex items-center gap-6">
            <Button
              variant="destructive"
              size="icon"
              onClick={onDecline}
              className="rounded-full w-14 h-14"
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
            <Button
              size="icon"
              onClick={onAnswer}
              className="rounded-full w-14 h-14 bg-green-600 hover:bg-green-700"
            >
              <Phone className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
