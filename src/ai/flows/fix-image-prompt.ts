'use server';

/**
 * @fileOverview An AI flow to fix and improve image generation prompts.
 *
 * - fixImagePrompt - A function that analyzes and rewrites a failing image prompt.
 * - FixImagePromptInput - The input type for the function.
 * - FixImagePromptOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const FixImagePromptInputSchema = z.object({
  promptText: z.string().describe('The image generation prompt that needs to be fixed.'),
});
export type FixImagePromptInput = z.infer<typeof FixImagePromptInputSchema>;

const FixImagePromptOutputSchema = z.object({
  fixedPrompt: z.string().describe('The rewritten, improved, and policy-compliant prompt.'),
});
export type FixImagePromptOutput = z.infer<typeof FixImagePromptOutputSchema>;

export async function fixImagePrompt(input: FixImagePromptInput): Promise<FixImagePromptOutput> {
  return fixImagePromptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'fixImagePrompt',
  input: {schema: FixImagePromptInputSchema},
  output: {schema: FixImagePromptOutputSchema},
  prompt: `You are an expert prompt engineer for an AI image generation model.
Your task is to analyze the following prompt, which has likely failed due to safety policy violations or a lack of clarity.
Rewrite the prompt to make it compliant and effective, while preserving the user's original creative intent as much as possible.

Common reasons for failure include:
- Depicting realistic violence, gore, or hate symbols.
- Generating sexually explicit content.
- Creating images of real, named individuals in a harmful or misleading way.
- Ambiguous or contradictory descriptions that confuse the model.

Analyze the following prompt:
---
{{{promptText}}}
---

Rewrite it to be safe and effective. Return only the new prompt in the specified JSON format.
`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
       {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
    ],
  },
});

const fixImagePromptFlow = ai.defineFlow(
  {
    name: 'fixImagePromptFlow',
    inputSchema: FixImagePromptInputSchema,
    outputSchema: FixImagePromptOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
