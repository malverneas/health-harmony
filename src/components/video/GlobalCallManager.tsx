import { useCall } from "@/contexts/CallContext";
import { useAuth } from "@/contexts/AuthContext";
import { IncomingCallDialog } from "./IncomingCallDialog";
import { VideoCallDialog } from "./VideoCallDialog";

export function GlobalCallManager() {
    const { incomingCall, activeCall, answerCall, declineCall, endCall } = useCall();
    const { user } = useAuth();

    return (
        <>
            {incomingCall && (
                <IncomingCallDialog
                    onAnswer={answerCall}
                    onDecline={declineCall}
                    callerName={incomingCall.callerName}
                />
            )}
            {activeCall && (
                <VideoCallDialog
                    open={!!activeCall}
                    onOpenChange={(open) => !open && endCall()}
                    recipientId={activeCall.recipientId}
                    recipientName={activeCall.recipientName}
                    consultationId={activeCall.consultationId}
                    userRole={user?.role as 'doctor' | 'patient'}
                />
            )}
        </>
    );
}
