import { z } from 'zod';

/**
 * Author: Raushan Raj
 * Business Use: Fail fast when external login data is incomplete/invalid.
 * How to use: LoginDataSchema.parse(record) after reading a file.
 * Benefit: Prevents misleading browser failures caused by bad test data.
 */
export const LoginDataSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  role: z.string().optional()
});
export type LoginData = z.infer<typeof LoginDataSchema>;
