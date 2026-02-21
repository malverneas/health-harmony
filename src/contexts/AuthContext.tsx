import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  pharmacyName?: string;
  pharmacyAddress?: string;
  licenseNumber?: string;
  specialty?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const fetchUserData = async (userId: string, attempts = 3) => {
    console.log(`[AuthContext] 🔄 fetchUserData started for ${userId}. Attempt: ${4 - attempts}`);

    // Simple helper for timing out the supabase call
    const fetchWithTimeout = async <T,>(promise: Promise<T> | PromiseLike<T>, timeoutMs = 8000): Promise<T> => {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('PostgREST request timed out')), timeoutMs)
      );
      return Promise.race([promise, timeoutPromise]) as Promise<T>;
    };

    try {
      console.log(`[AuthContext] 🔍 Checking 'profiles' table for user_id: ${userId}`);
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const { data: profile, error: profileError } = (await fetchWithTimeout(profilePromise)) as any;

      if (profileError) {
        console.error('[AuthContext] ❌ Profile fetch error:', profileError);
      } else {
        console.log(`[AuthContext] ✅ Profile check complete. Found: ${!!profile}`);
      }

      console.log(`[AuthContext] 🔍 Checking 'user_roles' table for user_id: ${userId}`);
      const rolePromise = supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      const { data: roleData, error: roleError } = (await fetchWithTimeout(rolePromise)) as any;

      if (roleError) {
        console.error('[AuthContext] ❌ Role fetch error:', roleError);
      } else {
        console.log(`[AuthContext] ✅ Role check complete. Found: ${!!roleData?.role}`);
      }

      if (profile && roleData) {
        console.log(`[AuthContext] 🎉 Full user data retrieved. Role: ${roleData.role}`);
        setUser({
          id: userId,
          email: profile.email,
          fullName: profile.full_name,
          role: roleData.role as UserRole,
        });
        setIsLoading(false);
        return true;
      } else if (attempts > 0) {
        console.warn(`[AuthContext] ⚠️ Data missing (trigger lag?). Retrying in 1.5s... (${attempts} attempts left)`);
        setTimeout(() => {
          fetchUserData(userId, attempts - 1);
        }, 1500);
        return false;
      } else {
        console.error(`[AuthContext] 🛑 Failed to fetch user data after all retries. Is the profile actually created in the DB?`);
        setIsLoading(false);
        return false;
      }
    } catch (error) {
      console.error('[AuthContext] 🔥 Fatal error in fetchUserData:', error);
      if (error instanceof Error && error.message.includes('timed out')) {
        console.error('[AuthContext] 🚨 DATABASE TIMEOUT! This usually means:\n1. Your project is PAUSED\n2. There is an RLS recursion loop in user_roles table.');
      }
      if (attempts > 0) {
        console.log('[AuthContext] Retrying due to error...');
        setTimeout(() => {
          fetchUserData(userId, attempts - 1);
        }, 1500);
      } else {
        setIsLoading(false);
      }
      return false;
    }
  };

  useEffect(() => {
    // Check for existing session on mount
    const checkSession = async () => {
      console.log("[AuthContext] 🚀 App mounted. Checking existing session...");
      try {
        // QUICK CONNECTIVITY TEST
        console.log("[AuthContext] 🌐 Testing basic DB connectivity...");
        const { error: pingError } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).limit(1);
        if (pingError) {
          console.error("[AuthContext] ❌ DB connectivity test failed:", pingError);
        } else {
          console.log("[AuthContext] ✅ DB connectivity test successful.");
        }

        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        if (session?.user) {
          console.log("[AuthContext] 📂 Found existing session for:", session.user.email);
          fetchUserData(session.user.id);
        } else {
          console.log("[AuthContext] ℹ️ No existing session found.");
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[AuthContext] Error checking initial session:', error);
        setIsLoading(false);
      } finally {
        setIsInitialLoad(false);
      }
    };

    checkSession();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.log(`[AuthContext] 🔔 Auth event changed: ${event}`, {
          hasUser: !!currentSession?.user,
          email: currentSession?.user?.email
        });

        setSession(currentSession);

        if (currentSession?.user) {
          setIsLoading(true);
          // Don't 'await' here to maintain listener responsiveness
          fetchUserData(currentSession.user.id);
        } else {
          console.log("[AuthContext] 👤 User signed out. Clearing state.");
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const register = async (data: RegisterData) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: data.fullName,
          role: data.role,
          pharmacy_name: data.pharmacyName,
          address: data.pharmacyAddress,
          license_number: data.licenseNumber,
          specialty: data.specialty,
        },
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        throw new Error('This email is already registered. Please sign in instead.');
      }
      throw new Error(error.message);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}