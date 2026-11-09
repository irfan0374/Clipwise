import { CalendarDays, Clapperboard, type LucideIcon, Palette, Settings, Shield, Sparkles } from "lucide-react";

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
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Brand kit", href: "/brand", icon: Palette },
  { label: "Settings", href: "/settings", icon: Settings },
];

/** An item is active on its own page and on any page below it (/videos/123 → Videos). */
export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export const navigationFor = (role: string): NavItem[] =>
  role === "admin" ? [...navItems, { label: "Admin", href: "/admin", icon: Shield }] : navItems;
