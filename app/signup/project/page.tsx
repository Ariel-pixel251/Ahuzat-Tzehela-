import type { Metadata } from "next";
import SignupForm from "@/components/SignupForm";
import { getProject, projects } from "@/lib/data";

export const metadata: Metadata = { title: "הרשמה לפרויקט – אחוזת צהלה" };

export default async function ProjectSignupPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const selected = getProject(project)?.slug;

  return (
    <>
      <h1>הרשמה לפרויקט</h1>
      <p className="lead">בחרו פרויקט ומלאו פרטים. מנהיג הפרויקט ייצור איתכם קשר.</p>
      <SignupForm kind="project" submitLabel="הרשמה לפרויקט">
        <fieldset>
          <legend>פרויקט</legend>
          {projects.map((p) => (
            <label key={p.slug} className="choice">
              <input type="radio" name="target" value={p.slug} defaultChecked={p.slug === selected} required />
              {p.name}
            </label>
          ))}
        </fieldset>
      </SignupForm>
    </>
  );
}
