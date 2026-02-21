import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Video, VideoOff, Mic, MicOff, PhoneOff, Loader2, MessageSquare } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VideoCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientId: string;
  recipientName: string;
  consultationId: string;
  onSwitchToChat?: () => void;
  userRole?: 'doctor' | 'patient';
}

interface SignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-ended';
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
  from: string;
  to: string;
}

export function VideoCallDialog({
  open,
  onOpenChange,
  recipientId,
  recipientName,
  consultationId,
  onSwitchToChat,
  userRole
}: VideoCallDialogProps) {
  const [isConnecting, setIsConnecting] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [remoteConnected, setRemoteConnected] = useState(false);

  const [isMediaReady, setIsMediaReady] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const { user } = useAuth();

  const configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  const cleanupCall = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setIsConnecting(true);
    setRemoteConnected(false);
    setIsMediaReady(false);
    pendingCandidates.current = [];
  }, []);

  const sendSignal = useCallback(async (message: SignalMessage) => {
    if (!channelRef.current) return;

    await channelRef.current.send({
      type: 'broadcast',
      event: 'signal',
      payload: message
    });
  }, []);

  const createPeerConnection = useCallback(() => {
    if (!user) return null;

    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          type: 'ice-candidate',
          data: event.candidate.toJSON(),
          from: user.id,
          to: recipientId
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("OnTrack event received", event.streams[0]);
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setRemoteConnected(true);
        setIsConnecting(false);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state change:", pc.connectionState);
      if (pc.connectionState === 'connected') {
        setIsConnecting(false);
        setRemoteConnected(true);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setRemoteConnected(false);
      }
    };

    // Add local tracks if media is ready
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    return pc;
  }, [user, recipientId, sendSignal]);

  const handleSignal = useCallback(async (message: SignalMessage) => {
    if (!user || message.to !== user.id) return;
    console.log("Received signal:", message.type);

    try {
      if (message.type === 'offer') {
        // Only accept offer if media is ready
        if (!localStreamRef.current) {
          console.log("Discarding offer because media not ready");
          return;
        }

        if (!peerConnectionRef.current) {
          peerConnectionRef.current = createPeerConnection();
        }
        const pc = peerConnectionRef.current;
        if (!pc) return;

        await pc.setRemoteDescription(new RTCSessionDescription(message.data as RTCSessionDescriptionInit));

        // Add any pending candidates
        while (pendingCandidates.current.length > 0) {
          const candidate = pendingCandidates.current.shift();
          if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        sendSignal({
          type: 'answer',
          data: answer,
          from: user.id,
          to: message.from
        });
      } else if (message.type === 'answer') {
        const pc = peerConnectionRef.current;
        if (pc && pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(message.data as RTCSessionDescriptionInit));

          // Add any pending candidates
          while (pendingCandidates.current.length > 0) {
            const candidate = pendingCandidates.current.shift();
            if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
      } else if (message.type === 'ice-candidate') {
        const pc = peerConnectionRef.current;
        const candidateData = message.data as RTCIceCandidateInit;
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidateData));
        } else {
          // Buffer candidates until remote description is set
          pendingCandidates.current.push(candidateData);
        }
      } else if (message.type === 'call-ended') {
        cleanupCall();
        onOpenChange(false);
        toast.info("The consultation has ended");
      }
    } catch (error) {
      console.error('Error handling signal:', error);
    }
  }, [user, createPeerConnection, sendSignal]);

  const initMedia = useCallback(async () => {
    if (!user) return;

    try {
      console.log("Initializing media...");

      // Check if mediaDevices API is available (requires HTTPS or localhost)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error(
          "Video calls require a secure connection (HTTPS). Please access the app via HTTPS or localhost.",
          { duration: 8000 }
        );
        onOpenChange(false);
        return;
      }

      // Try video + audio first
      let stream: MediaStream | null = null;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        console.log("Got video + audio stream");
      } catch (err: any) {
        console.warn("Could not get video+audio, trying audio only:", err.name);

        // Fallback: audio only
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
          });
          setIsVideoEnabled(false);
          toast.info("Camera unavailable — joining with audio only");
          console.log("Got audio-only stream");
        } catch (err2: any) {
          console.warn("Could not get audio either, trying video only:", err2.name);

          // Fallback: video only
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false
            });
            setIsAudioEnabled(false);
            toast.info("Microphone unavailable — joining with video only");
            console.log("Got video-only stream");
          } catch (err3: any) {
            console.error("No media available at all:", err3.name);
            throw err3;
          }
        }
      }

      if (stream) {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setIsMediaReady(true);
        console.log("Media ready.");
      }

    } catch (error: any) {
      console.error('Error accessing media:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        toast.error("Camera/microphone permission denied. Please allow access in your browser settings and try again.");
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        toast.error("No camera or microphone found. Please connect a device and try again.");
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        toast.error("Camera/microphone is already in use by another application. Please close it and try again.");
      } else {
        toast.error("Failed to access camera/microphone. Please check your device permissions.");
      }
      onOpenChange(false);
    }
  }, [user, onOpenChange]);

  const sendOffer = useCallback(async () => {
    if (!localStreamRef.current) {
      console.log("Delayed offer: media not ready");
      return;
    }

    if (!peerConnectionRef.current) {
      peerConnectionRef.current = createPeerConnection();
    }
    const pc = peerConnectionRef.current;
    if (!pc || !user) return;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    console.log("Sending offer...");
    sendSignal({
      type: 'offer',
      data: offer,
      from: user.id,
      to: recipientId
    });
  }, [user, recipientId, sendSignal, createPeerConnection]);

  useEffect(() => {
    if (!open || !user) return;

    const channelName = `video-${[user.id, recipientId].sort().join('-')}`;
    const channel = supabase.channel(channelName);

    channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
      handleSignal(payload as SignalMessage);
    });

    channel.on('presence', { event: 'join' }, async ({ newPresences }) => {
      const otherJoined = newPresences.some((p: any) => p.user_id === recipientId);
      console.log("Other joined presence:", otherJoined);
      if (otherJoined && user.id < recipientId) {
        // We are the caller (lowest ID)
        // Wait bit to ensure they are also ready
        setTimeout(() => sendOffer(), 2000);
      }
    });

    channel.on('presence', { event: 'sync' }, async () => {
      const state = channel.presenceState();
      const allPresences = Object.values(state).flat() as any[];
      const otherPresent = allPresences.some((p: any) => p.user_id === recipientId);
      console.log("Other present on sync:", otherPresent);
      if (otherPresent && user.id < recipientId) {
        setTimeout(() => sendOffer(), 2000);
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        channelRef.current = channel;
        await initMedia();
        await channel.track({ user_id: user.id });
      }
    });

    return () => {
      cleanupCall();
    };
  }, [open, user, recipientId, handleSignal, initMedia, sendOffer, cleanupCall]);

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const endCall = async () => {
    if (userRole === 'doctor') {
      try {
        // Mark consultation as completed
        const { error } = await supabase
          .from('consultations')
          .update({ status: 'completed' })
          .eq('id', consultationId);

        if (error) throw error;

        // Notify patient
        await sendSignal({
          type: 'call-ended',
          data: {} as any,
          from: user!.id,
          to: recipientId
        });

      } catch (error) {
        console.error('Error ending consultation:', error);
        toast.error("Failed to finalize consultation");
      }
    }

    cleanupCall();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) cleanupCall();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[800px] h-[600px] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Video Call with {recipientName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 relative bg-black overflow-hidden">
          {/* Remote video (full size) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Local video (picture-in-picture) */}
          <div className="absolute bottom-4 right-4 w-32 h-24 rounded-lg overflow-hidden border-2 border-primary shadow-lg bg-muted">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>

          {/* Connection status */}
          {isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="text-center text-white">
                <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
                <p className="text-lg">Waiting for {recipientName} to join...</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Make sure both parties have the call window open
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-t bg-background flex items-center justify-center gap-4">
          <Button
            variant={isVideoEnabled ? "outline" : "destructive"}
            size="icon"
            onClick={toggleVideo}
            className="rounded-full w-12 h-12"
          >
            {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </Button>

          <Button
            variant={isAudioEnabled ? "outline" : "destructive"}
            size="icon"
            onClick={toggleAudio}
            className="rounded-full w-12 h-12"
          >
            {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </Button>

          {onSwitchToChat && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                cleanupCall();
                onSwitchToChat();
              }}
              className="rounded-full w-12 h-12"
            >
              <MessageSquare className="w-5 h-5" />
            </Button>
          )}

          <Button
            variant="destructive"
            size="icon"
            onClick={endCall}
            className="rounded-full w-12 h-12"
          >
            <PhoneOff className="w-5 h-5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
