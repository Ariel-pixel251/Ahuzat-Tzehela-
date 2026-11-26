import type { WizardStep } from "@/components/Wizard";
import { residentsText } from "@/lib/i18n";

// The report-a-problem wizard (one question per screen). Sign-ups use the two-screen pattern in
// lib/resident-signup.ts instead.

const f = residentsText.fields;

export const reportSteps: WizardStep[] = [
  { id: "message", title: f.reportMessage, fields: [{ kind: "text", name: "message", label: f.reportMessageLabel, multiline: true }] },
  {
    id: "contact",
    title: f.reportContactTitle,
    reviewLabel: f.reportContactTitle,
    fields: [
      { kind: "text", name: "name", label: f.nameLabel, optional: true, autoComplete: "name" },
      { kind: "text", name: "phone", label: f.phoneLabel, type: "tel", check: "phone", optional: true, autoComplete: "tel" },
    ],
  },
];
