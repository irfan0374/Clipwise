import { CalendarDays, Clapperboard, type LucideIcon, Palette, Settings, Sparkles } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Shown greyed out with a "Soon" badge until its feature ships. */
  soon?: boolean;
};

export const navItems: NavItem[] = [
  { label: "Create", href: "/create", icon: Sparkles },
  { label: "Videos", href: "/videos", icon: Clapperboard },
  { label: "Calendar", href: "/calendar", icon: CalendarDays, soon: true }, // Feature 18
  { label: "Brand kit", href: "/brand", icon: Palette, soon: true }, // Feature 17
  { label: "Settings", href: "/settings", icon: Settings },
];

/** An item is active on its own page and on any page below it (/videos/123 → Videos). */
export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
