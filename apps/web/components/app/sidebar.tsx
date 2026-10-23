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
import { Logo } from "./logo";
import { UsageMeter } from "./usage-meter";

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

function SidebarFooter({ user }: { user: SidebarUser }) {
  const router = useRouter();
  const signOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };
  // Usage numbers are placeholders until limits (step G).
  return (
    <div className="mt-auto space-y-3">
      <UsageMeter label="Videos today" used={0} limit={10} />
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
export function Sidebar({ user }: { user: SidebarUser }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-8 border-r border-line bg-sidebar px-4 py-5 lg:flex">
        <Logo href="/create" className="px-2" />
        <NavList />
        <SidebarFooter user={user} />
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
            <SidebarFooter user={user} />
          </SheetContent>
        </Sheet>
      </header>
    </>
  );
}
