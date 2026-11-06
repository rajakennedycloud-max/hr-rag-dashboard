import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { addDays, differenceInDays, isAfter, isBefore } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// RAG scoring activates after a short buffer so candidates are not penalized
// in the first days after the offer is extended. Buffer = max(48h, 10% of the
// offer→DOJ window), capped at 7 days.
export function getRagActivationDate(offerDate: Date, doj: Date): Date {
  const totalDays = Math.max(0, differenceInDays(doj, offerDate));
  const bufferDays = Math.min(7, Math.max(2, Math.floor(totalDays * 0.1)));
  return addDays(offerDate, bufferDays);
}

export function shouldRagBeActive(
  offerDate: Date,
  doj: Date,
  now: Date = new Date()
): boolean {
  return !isBefore(now, getRagActivationDate(offerDate, doj));
}

export function getConnect1DueDate(offerDate: Date, doj: Date): Date {
  return addDays(offerDate, Math.floor(differenceInDays(doj, offerDate) * 0.33));
}

export function getConnect2DueDate(offerDate: Date, doj: Date): Date {
  return addDays(offerDate, Math.floor(differenceInDays(doj, offerDate) * 0.66));
}
