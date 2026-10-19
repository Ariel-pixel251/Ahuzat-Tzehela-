import Link from "next/link";
import { adminLogout } from "@/app/actions/admin";
import { buttonClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

const nav = [
  ["/admin", "Dashboard"],
  ["/admin/events", "Events"],
  ["/admin/digital", "Digital support"],
  ["/admin/podcast", "Podcast"],
  ["/admin/lessons", "Lessons"],
  ["/admin/lectures", "Lectures"],
  ["/admin/visits", "Visits"],
  ["/admin/callbacks", "Callbacks"],
  ["/admin/messages", "Messages"],
  ["/admin/register", "Register a resident"],
  ["/admin/print", "Sign-up sheet"],
  ["/admin/leaders", "Leaders"],
  ["/admin/content", "Content"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <>
      <header className="no-print border-b-2 border-line bg-sand">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link href="/admin" className="text-lg font-extrabold">Ahuzat Tzahala · Admin</Link>
          <div className="flex items-center gap-3 text-sm">
            <span>{admin.email}</span>
            <form action={adminLogout}>
              <button type="submit" className={buttonClass.small}>Sign out</button>
            </form>
          </div>
        </div>
        <nav aria-label="Admin" className="mx-auto max-w-6xl px-4 pb-3">
          <ul className="flex flex-wrap gap-1">
            {nav.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-bold text-brand hover:bg-brand-soft">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
