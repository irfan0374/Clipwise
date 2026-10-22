"use client";

import { cn } from "cn";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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

function SidebarFooter() {
  // Placeholder user and usage until sign-in (Feature 5) and limits (Feature 13).
  return (
    <div className="mt-auto space-y-3">
      <UsageMeter label="Videos today" used={3} limit={10} />
      <div className="flex items-center gap-3 rounded-lg px-1 py-1">
        <Avatar className="size-8">
          <AvatarFallback className="bg-wash text-label font-semibold text-ink">YO</AvatarFallback>
        </Avatar>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-small font-medium text-ink">Your name</p>
          <p className="truncate text-label text-ink-3">Beta</p>
        </div>
      </div>
    </div>
  );
}

/** Desktop: fixed 240px sidebar. Mobile: top bar whose menu button slides the same sidebar in. */
export function Sidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-8 border-r border-line bg-sidebar px-4 py-5 lg:flex">
        <Logo href="/create" className="px-2" />
        <NavList />
        <SidebarFooter />
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
            <SidebarFooter />
          </SheetContent>
        </Sheet>
      </header>
    </>
  );
}
