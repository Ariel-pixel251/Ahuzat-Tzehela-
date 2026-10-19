import { setReviewStatus } from "@/app/actions/admin";
import { ActionButton } from "./ActionButton";

/** Buttons to move a reviewed item (lecture proposal, visit request) to another status. */
export function StatusButtons({ kind, id, current, statuses }: { kind: "lecture" | "visit"; id: string; current: string; statuses: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {statuses
        .filter((s) => s !== current)
        .map((s) => (
          <ActionButton key={s} action={setReviewStatus} fields={{ kind, id, status: s }} label={s} variant="small" />
        ))}
    </div>
  );
}
