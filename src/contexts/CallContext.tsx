import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface CallState {
    incomingCall: {
        callerId: string;
        callerName: string;
        consultationId: string;
    } | null;
    activeCall: {
        recipientId: string;
        recipientName: string;
        consultationId: string;
    } | null;
}

interface CallContextType extends CallState {
    setIncomingCall: (call: CallState['incomingCall']) => void;
    setActiveCall: (call: CallState['activeCall']) => void;
    answerCall: () => void;
    declineCall: () => void;
    endCall: () => void;
    initiateCall: (recipientId: string, recipientName: string, consultationId: string) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [state, setState] = useState<CallState>({
        incomingCall: null,
        activeCall: null,
    });

    useEffect(() => {
        if (!user) return;

        const channel = supabase.channel(`incoming-calls-${user.id}`);

        channel.on('broadcast', { event: 'incoming-call' }, ({ payload }) => {
            if (payload.to === user.id) {
                setState(prev => ({
                    ...prev,
                    incomingCall: {
                        callerId: payload.from,
                        callerName: payload.callerName,
                        consultationId: payload.consultationId,
                    }
                }));
            }
        });

        channel.subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const setIncomingCall = useCallback((call: CallState['incomingCall']) => {
        setState(prev => ({ ...prev, incomingCall: call }));
    }, []);

    const setActiveCall = useCallback((call: CallState['activeCall']) => {
        setState(prev => ({ ...prev, activeCall: call }));
    }, []);

    const initiateCall = useCallback((recipientId: string, recipientName: string, consultationId: string) => {
        setState(prev => ({
            ...prev,
            activeCall: { recipientId, recipientName, consultationId }
        }));
    }, []);

    const answerCall = useCallback(() => {
        if (state.incomingCall) {
            setState(prev => ({
                incomingCall: null,
                activeCall: {
                    recipientId: prev.incomingCall!.callerId,
                    recipientName: prev.incomingCall!.callerName,
                    consultationId: prev.incomingCall!.consultationId,
                }
            }));
        }
    }, [state.incomingCall]);

    const declineCall = useCallback(() => {
        setState(prev => ({ ...prev, incomingCall: null }));
    }, []);

    const endCall = useCallback(() => {
        setState(prev => ({ ...prev, activeCall: null }));
    }, []);

    return (
        <CallContext.Provider value={{
            ...state,
            setIncomingCall,
            setActiveCall,
            answerCall,
            declineCall,
            endCall,
            initiateCall
        }}>
            {children}
        </CallContext.Provider>
    );
}

export function useCall() {
    const context = useContext(CallContext);
    if (context === undefined) {
        throw new Error('useCall must be used within a CallProvider');
    }
    return context;
}
