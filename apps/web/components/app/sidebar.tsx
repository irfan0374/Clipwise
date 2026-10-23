"use client";

import { cn } from "cn";
import { ChevronsUpDown, LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { authClient } from "@/lib/auth-client";
import { isActive, navItems } from "@/lib/nav";
import { LiveUsageMeter } from "./live-usage-meter";
import { Logo } from "./logo";

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {navItems.map(({ label, href, icon: Icon, soon }) => {
        if (soon) {
          return (
            <span
              key={href}
              aria-disabled="true"
              className="flex h-10 cursor-default items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink-3"
            >
              <Icon className="size-4.5" strokeWidth={1.5} />
              {label}
              <Badge variant="outline" className="ml-auto h-5 px-2 text-[11px] text-ink-3">
                Soon
              </Badge>
            </span>
          );
        }
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/40",
              active ? "bg-ink text-white" : "text-ink-2 hover:bg-wash hover:text-ink",
            )}
          >
            <Icon className="size-4.5" strokeWidth={1.5} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export type SidebarUser = { name: string; email: string; image: string | null; role: string };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

type Usage = { used: number; limit: number };

function SidebarFooter({ user, usage }: { user: SidebarUser; usage: Usage }) {
  const router = useRouter();
  const signOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };
  return (
    <div className="mt-auto space-y-3">
      <LiveUsageMeter initial={usage} />
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left outline-none transition-colors hover:bg-wash focus-visible:ring-3 focus-visible:ring-ring/40">
          <Avatar className="size-8">
            {user.image && <AvatarImage src={user.image} alt="" referrerPolicy="no-referrer" />}
            <AvatarFallback className="bg-wash text-label font-semibold text-ink">{initials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-small font-medium text-ink">{user.name}</span>
            <span className="block truncate text-label text-ink-3">
              {user.role === "admin" ? "Admin · Beta" : "Beta"}
            </span>
          </span>
          <ChevronsUpDown className="size-4 text-ink-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuLabel className="truncate font-normal text-ink-2">{user.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={signOut}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Desktop: fixed 240px sidebar. Mobile: top bar whose menu button slides the same sidebar in. */
export function Sidebar({ user, usage }: { user: SidebarUser; usage: Usage }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-8 border-r border-line bg-sidebar px-4 py-5 lg:flex">
        <Logo href="/create" className="px-2" />
        <NavList />
        <SidebarFooter user={user} usage={usage} />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper/90 px-4 backdrop-blur lg:hidden">
        <Logo href="/create" />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col gap-8 bg-paper px-4 py-5">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SheetDescription className="sr-only">Main navigation</SheetDescription>
            <Logo href="/create" className="px-2" />
            <NavList onNavigate={() => setOpen(false)} />
            <SidebarFooter user={user} usage={usage} />
          </SheetContent>
        </Sheet>
      </header>
    </>
  );
}

/** Stitch's collapsed 64px icon rail (Storyboard): logo, nav icons, today's usage ring and the account menu. */
export function IconRail({ user, usage }: { user: SidebarUser; usage: Usage }) {
  const pathname = usePathname();
  const router = useRouter();
  const signOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };
  const used = Math.min(usage.used, usage.limit);
  const pct = usage.limit ? Math.round((used / usage.limit) * 100) : 0;
  const icon = "grid size-10 place-items-center rounded-lg transition-all duration-150";
  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-16 flex-col items-center justify-between border-r border-line bg-paper py-4 select-none lg:flex">
      <div className="flex w-full flex-col items-center gap-6">
        <Link
          href="/create"
          aria-label="Clipwise"
          className="grid size-9 place-items-center rounded-lg bg-lime shadow-[0_2px_8px_rgba(198,244,50,0.3)] transition-transform hover:scale-105 active:scale-95"
        >
          <svg viewBox="0 0 16 16" className="size-4 fill-ink" aria-hidden="true">
            <path d="M5 3.5v9l7-4.5z" />
          </svg>
        </Link>
        <nav aria-label="Main" className="flex w-full flex-col items-center gap-2 px-2">
          {navItems.map(({ label, href, icon: Icon, soon }) => {
            if (soon) {
              return (
                <span
                  key={href}
                  aria-disabled="true"
                  title={`${label} · Coming soon`}
                  className={cn(icon, "cursor-default text-ink-3/60")}
                >
                  <Icon className="size-[18px]" strokeWidth={1.75} />
                </span>
              );
            }
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  icon,
                  "relative",
                  active
                    ? "border border-line bg-panel text-ink shadow-xs"
                    : "text-ink-2 hover:bg-panel hover:text-ink",
                )}
              >
                <Icon className="size-[18px]" strokeWidth={active ? 2 : 1.75} />
                {active && <span className="absolute top-2 right-2 size-1.5 rounded-full bg-teal" />}
                <span className="sr-only">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex w-full flex-col items-center gap-3 px-2">
        <div className="relative grid size-8 place-items-center" title={`${used} of ${usage.limit} videos today`}>
          <svg className="size-8 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--line)" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15.9155"
              fill="none"
              stroke="var(--teal)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${pct}, 100`}
            />
          </svg>
          <span className="absolute text-[10px] font-semibold text-ink tabular-nums">
            {used}/{usage.limit}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Account"
            className="grid size-8 place-items-center rounded-full bg-ink text-[11px] font-medium text-white shadow-xs ring-2 ring-white outline-none transition-opacity hover:opacity-90 focus-visible:ring-ring/40"
          >
            {initials(user.name)}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-56">
            <DropdownMenuLabel className="truncate font-normal text-ink-2">{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
