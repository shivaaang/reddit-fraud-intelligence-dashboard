import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function toTitleCase(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
