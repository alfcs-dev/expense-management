import { z } from "zod";

/** CUID as used by Prisma @default(cuid()). */
export const idSchema = z.string().cuid();
