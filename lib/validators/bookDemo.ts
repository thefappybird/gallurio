import { z } from "zod";

export const bookDemoSubmissionSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  businessName: z.string().trim().min(1, "Please enter your business name").max(100),
  message: z
    .string()
    .trim()
    .min(1, "Please tell us what you'd like to see")
    .max(2000),
});

export type BookDemoSubmissionInput = z.infer<typeof bookDemoSubmissionSchema>;
