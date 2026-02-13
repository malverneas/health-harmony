import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/layout/GlassCard";
import {
  Stethoscope,
  Video,
  FileText,
  Shield,
  ArrowRight,
  Sparkles,
  Clock,
  Users,
  Moon,
  Sun
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

const features = [
  {
    icon: Video,
    title: "Video Consultations",
    description: "Connect with doctors instantly through HD video calls",
  },
  {
    icon: FileText,
    title: "Digital Prescriptions",
    description: "Receive and manage prescriptions electronically",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "Your health data is encrypted and protected",
  },
  {
    icon: Clock,
    title: "24/7 Available",
    description: "Access healthcare services anytime, anywhere",
  },
];

export default function Index() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (isAuthenticated && user) {
      const path = user.role === "pharmacist" ? "/pharmacy" : `/${user.role}`;
      navigate(path);
    }
  }, [isAuthenticated, user, navigate]);

  return (
    <div className="min-h-screen bg-hero-gradient overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "3s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-4 lg:p-6">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center animate-pulse-glow">
              <Stethoscope className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xl font-display font-bold gradient-text">MediConnect</span>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300"
            >
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>

            <Button onClick={() => navigate("/auth")} variant="neon" size="lg">
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="relative z-10 px-4 lg:px-6 pt-20 lg:pt-32 pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 animate-fade-in">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Next-gen Healthcare Platform</span>
            </div>

            <h1 className="text-4xl lg:text-7xl font-display font-bold mb-6 animate-slide-up">
              Healthcare at Your
              <span className="block gradient-text neon-text">Fingertips</span>
            </h1>

            <p className="text-lg lg:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: "0.2s" }}>
              Connect with doctors, manage prescriptions, and take control of your health journey with our comprehensive healthcare platform.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: "0.4s" }}>
              <Button onClick={() => navigate("/auth")} size="xl" className="w-full sm:w-auto">
                Start Now — It's Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button variant="outline" size="xl" className="w-full sm:w-auto">
                Watch Demo
              </Button>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-16 mt-16 animate-fade-in" style={{ animationDelay: "0.6s" }}>
              {[
                { value: "10K+", label: "Active Patients" },
                { value: "500+", label: "Verified Doctors" },
                { value: "50K+", label: "Consultations" },
                { value: "4.9★", label: "User Rating" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-3xl lg:text-4xl font-display font-bold gradient-text">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-24">
            {features.map((feature, index) => (
              <GlassCard
                key={feature.title}
                hover
                className="p-6 animate-slide-up"
                style={{ animationDelay: `${0.8 + index * 0.1}s` }}
              >
                <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </GlassCard>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-24 text-center">
            <GlassCard className="p-8 lg:p-12 max-w-3xl mx-auto neon-border animate-fade-in">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Users className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium text-primary">Join thousands of users</span>
              </div>
              <h2 className="text-2xl lg:text-4xl font-display font-bold mb-4">
                Ready to transform your healthcare experience?
              </h2>
              <p className="text-muted-foreground mb-8">
                Sign up now and get access to video consultations, digital prescriptions, and more.
              </p>
              <Button onClick={() => navigate("/auth")} size="xl">
                Create Free Account
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </GlassCard>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 p-6 text-center text-muted-foreground text-sm">
        <p>© 2024 MediConnect. Built with ❤️ for better healthcare.</p>
      </footer>
    </div>
  );
}
