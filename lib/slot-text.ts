import { formatSlot } from "@/lib/i18n/format";

/** The booked slot in plain Hebrew, from the booking action's answer (for the confirmation screen). */
export function bookedSlotLine(data: unknown): string | null {
  const slot = (data as { slot?: Parameters<typeof formatSlot>[0] } | undefined)?.slot;
  return slot ? formatSlot(slot, "he") : null;
}
