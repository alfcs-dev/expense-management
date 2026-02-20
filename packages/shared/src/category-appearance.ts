import { z } from "zod";

export const CATEGORY_ICON_NAMES = [
  "Circle",
  "Wallet",
  "Landmark",
  "Banknote",
  "Coins",
  "BadgeDollarSign",
  "Briefcase",
  "PiggyBank",
  "ShoppingCart",
  "Utensils",
  "Car",
  "House",
  "HeartPulse",
  "GraduationCap",
  "Plane",
  "Receipt",
  "Gamepad2",
  "Gift",
  "Wrench",
  "Sparkles",
] as const;

export const categoryIconNameSchema = z.enum(CATEGORY_ICON_NAMES);

export const categoryColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a 6-digit hex code");

export type CategoryIconName = z.infer<typeof categoryIconNameSchema>;
