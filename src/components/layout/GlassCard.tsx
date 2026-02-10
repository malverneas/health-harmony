import { cn } from "@/lib/utils";
import { ReactNode, CSSProperties } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  neon?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

export function GlassCard({ 
  children, 
  className, 
  hover = false, 
  neon = false,
  onClick,
  style
}: GlassCardProps) {
  return (
    <div 
      className={cn(
        hover ? "glass-card-hover" : "glass-card",
        neon && "neon-border",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
}
