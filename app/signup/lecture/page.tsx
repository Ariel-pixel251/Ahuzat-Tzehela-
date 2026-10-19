import type { Metadata } from "next";
import SignupForm from "@/components/SignupForm";

export const metadata: Metadata = { title: "הצעת הרצאה – אחוזת צהלה" };

export default function LectureProposalPage() {
  return (
    <>
      <h1>הצעת הרצאה</h1>
      <p className="lead">דיירים שרוצים לבוא להרצות אצלנו מוזמנים להציע את עצמם.</p>
      <SignupForm kind="lecture" notesLabel="כמה מילים על ההרצאה (לא חובה)" submitLabel="שליחת ההצעה">
        <label>
          נושא ההרצאה
          <input name="title" required maxLength={200} />
        </label>
        <label>
          שפת ההרצאה (לא חובה)
          <input name="language" maxLength={50} placeholder="עברית" />
        </label>
      </SignupForm>
    </>
  );
}
