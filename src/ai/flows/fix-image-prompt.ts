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
  prompt: `You are an expert prompt engineer for an AI image generation model, specializing in mythological and fantasy themes.
Your task is to analyze the following prompt, which has failed, likely due to safety policy violations or ambiguity.
Rewrite the prompt to be compliant and effective, while preserving the user's creative intent. Focus on artistic and descriptive language.

Common reasons for failure include:
- Depicting realistic violence or gore. Rephrase to focus on the epic, fantasy, or symbolic nature of a conflict. Use terms like 'clash of divine energy', 'a flurry of motion', 'powerful stance' instead of graphic descriptions.
- Generating sexually explicit content. Rephrase to focus on artistic nudity, mythological forms, or ethereal beauty, avoiding suggestive or explicit terms.
- Creating images of real people in a harmful way. Remove names of real individuals.
- Ambiguity or contradictions. Clarify the scene, subject, and style for the model.

Analyze the original failing prompt:
---
{{{promptText}}}
---

Rewrite it into a new, safe, and effective prompt. The new prompt should be rich in visual detail and evocative language. Return only the new prompt in the specified JSON format.
`,
  config: {
    // Relax safety settings for the fixer itself, so it can analyze the problematic prompt without being blocked.
    safetySettings: [
       {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
       {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE',
      },
       {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE',
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
    if (!output?.fixedPrompt) {
        throw new Error("The AI couldn't find a way to fix the prompt. Try rewriting it manually.");
    }
    return output;
  }
);
