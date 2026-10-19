import type { Metadata } from "next";
import SignupForm from "@/components/SignupForm";
import { events, formatEventDate, getEvent } from "@/lib/data";

export const metadata: Metadata = { title: "הרשמה לאירוע – אחוזת צהלה" };

export default async function EventSignupPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event } = await searchParams;
  const selected = getEvent(event)?.id ?? "";

  return (
    <>
      <h1>הרשמה לאירוע</h1>
      <p className="lead">בחרו אירוע מהלוח ומלאו פרטים.</p>
      <SignupForm kind="event" submitLabel="הרשמה לאירוע">
        <label>
          אירוע
          <select name="target" defaultValue={selected} required>
            <option value="" disabled>
              בחרו אירוע…
            </option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} – {formatEventDate(e)}
                {e.tentative ? " (טרם אושר)" : ""}
              </option>
            ))}
          </select>
        </label>
      </SignupForm>
    </>
  );
}
