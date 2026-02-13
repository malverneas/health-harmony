import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/layout/GlassCard";
import { UserRole } from "@/types";
import {
  Stethoscope,
  User,
  Pill,
  Shield,
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Building,
  Moon,
  Sun
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/ThemeProvider";

const roles: { id: UserRole; label: string; icon: typeof User; description: string }[] = [
  { id: "patient", label: "Patient", icon: User, description: "Book consultations & manage health" },
  { id: "doctor", label: "Doctor", icon: Stethoscope, description: "Manage patients & prescriptions" },
  { id: "pharmacist", label: "Pharmacist", icon: Pill, description: "Handle prescriptions & orders" },
];

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [selectedRole, setSelectedRole] = useState<UserRole>("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [pharmacyName, setPharmacyName] = useState("");
  const [pharmacyAddress, setPharmacyAddress] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { login, register, isAuthenticated, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated && user) {
      const route = user.role === 'pharmacist' ? '/pharmacy' : `/${user.role}`;
      navigate(route, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        toast({
          title: "Welcome back!",
          description: "Redirecting to your dashboard...",
        });
      } else {
        await register({
          email,
          password,
          fullName,
          role: selectedRole,
          pharmacyName: selectedRole === 'pharmacist' ? pharmacyName : undefined,
          pharmacyAddress: selectedRole === 'pharmacist' ? pharmacyAddress : undefined,
          licenseNumber: selectedRole === 'doctor' ? licenseNumber : undefined,
          specialty: selectedRole === 'doctor' ? specialty : undefined,
        });
        toast({
          title: "Account created!",
          description: "Redirecting to your dashboard...",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-hero-gradient flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />
      </div>

      <div className="fixed top-6 right-6 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300"
        >
          {theme === "dark" ? <Sun className="w-5 h-5 text-primary" /> : <Moon className="w-5 h-5 text-primary" />}
        </Button>
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 mb-4 animate-pulse-glow">
            <Stethoscope className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-bold gradient-text">MediConnect</h1>
          <p className="text-muted-foreground mt-2">Healthcare Platform</p>
        </div>

        <GlassCard className="p-8">
          {/* Toggle */}
          <div className="flex p-1 mb-8 bg-muted/50 rounded-xl">
            <button
              onClick={() => setIsLogin(true)}
              className={cn(
                "flex-1 py-2 rounded-lg font-medium transition-all",
                isLogin ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={cn(
                "flex-1 py-2 rounded-lg font-medium transition-all",
                !isLogin ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Role Selection (only for signup) */}
            {!isLogin && (
              <div className="space-y-3">
                <label className="text-sm font-medium">I am a</label>
                <div className="grid grid-cols-2 gap-3">
                  {roles.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedRole(role.id)}
                      className={cn(
                        "p-4 rounded-xl border transition-all text-left",
                        selectedRole === role.id
                          ? "border-primary bg-primary/10 neon-border"
                          : "border-border bg-muted/30 hover:border-primary/50"
                      )}
                    >
                      <role.icon className={cn(
                        "w-5 h-5 mb-2",
                        selectedRole === role.id ? "text-primary" : "text-muted-foreground"
                      )} />
                      <p className="font-medium text-sm">{role.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{role.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Full Name (only for signup) */}
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="John Doe"
                    className="pl-10"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            {/* Doctor specific fields */}
            {!isLogin && selectedRole === 'doctor' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">License Number</label>
                  <Input
                    placeholder="MD12345"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Specialty</label>
                  <Input
                    placeholder="General Medicine"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {/* Pharmacist specific fields */}
            {!isLogin && selectedRole === 'pharmacist' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pharmacy Name</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="My Pharmacy"
                      className="pl-10"
                      value={pharmacyName}
                      onChange={(e) => setPharmacyName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pharmacy Address</label>
                  <Input
                    placeholder="123 Main St, City"
                    value={pharmacyAddress}
                    onChange={(e) => setPharmacyAddress(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {/* Email */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {isLogin ? "Sign In" : "Create Account"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}