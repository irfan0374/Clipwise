import type { Metadata } from "next";
import { CalendarView } from "@/components/calendar/calendar-view";
import { instagramAccounts } from "@/lib/instagram";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Calendar" };

// The posts themselves are loaded by the browser: days and times depend on the viewer's time zone.
export default async function CalendarPage() {
  const { workspace } = await requireUser();
  return <CalendarView instagram={await instagramAccounts(workspace._id)} />;
}
