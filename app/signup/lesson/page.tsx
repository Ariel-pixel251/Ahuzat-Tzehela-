import type { Metadata } from "next";
import SignupForm from "@/components/SignupForm";

export const metadata: Metadata = { title: "שיעורים פרטיים – אחוזת צהלה" };

export default function LessonSignupPage() {
  return (
    <>
      <h1>שיעורים פרטיים</h1>
      <p className="lead">
        אנחנו בונים רשימת נושאים לשיעורים פרטיים. כתבו מה תרצו ללמד או ללמוד, ונתאים בין המורים לתלמידים.
      </p>
      <SignupForm kind="lesson" submitLabel="שליחה">
        <fieldset>
          <legend>אני רוצה</legend>
          <label className="choice">
            <input type="radio" name="role" value="learn" required defaultChecked />
            ללמוד
          </label>
          <label className="choice">
            <input type="radio" name="role" value="teach" required />
            ללמד
          </label>
        </fieldset>
        <label>
          נושא השיעור
          <input name="topic" required maxLength={200} placeholder="לדוגמה: אנגלית, שימוש בסמארטפון, מתמטיקה" />
        </label>
      </SignupForm>
    </>
  );
}
