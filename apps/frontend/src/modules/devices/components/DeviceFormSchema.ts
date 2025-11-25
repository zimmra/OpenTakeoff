/**
 * Device Form Validation Schema
 * Zod schema matching backend validation
 */

import { z } from 'zod';

const hexColorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export const deviceFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Device name is required')
    .max(60, 'Device name must be 60 characters or less'),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .or(z.literal('')),
  color: z
    .string()
    .regex(hexColorRegex, 'Color must be a valid hex code (e.g., #FF0000)')
    .optional()
    .or(z.literal('')),
  iconKey: z
    .string()
    .max(1000, 'Icon key must be 1000 characters or less')
    .optional()
    .or(z.literal('')),
});

export type DeviceFormData = z.infer<typeof deviceFormSchema>;
