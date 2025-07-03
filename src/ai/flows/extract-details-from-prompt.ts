
'use server';

/**
 * @fileOverview Extracts a creation name and entity from a given prompt text.
 *
 * - extractDetailsFromPrompt - A function that handles the detail extraction process.
 * - ExtractDetailsInput - The input type for the function.
 * - ExtractDetailsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const ExtractDetailsInputSchema = z.object({
  promptText: z.string().describe('The image generation prompt from which to extract details.'),
});
export type ExtractDetailsInput = z.infer<typeof ExtractDetailsInputSchema>;

const ExtractDetailsOutputSchema = z.object({
  creationName: z.string().describe('A short, evocative name for the creation, suitable for a gallery title (e.g., "The Serpent of Ashes", "Cybernetic Griffin"). Should be 2-5 words.'),
  entity: z.string().describe('The primary subject, character, or theme of the prompt (e.g., "Phoenix", "Zeus", "World Tree"). Should be a single noun or a short phrase.'),
});
export type ExtractDetailsOutput = z.infer<typeof ExtractDetailsOutputSchema>;

export async function extractDetailsFromPrompt(input: ExtractDetailsInput): Promise<ExtractDetailsOutput> {
  return extractDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractDetailsPrompt',
  input: {schema: ExtractDetailsInputSchema},
  output: {schema: ExtractDetailsOutputSchema},
  prompt: `You are an expert in summarizing creative text. From the following image generation prompt, extract a concise, evocative name for the creation (creationName) and the main subject or theme (entity).

The creationName should be short and suitable for a gallery title (e.g., "The Serpent of Ashes", "Cybernetic Griffin"). It should be 2-5 words.
The entity should be the single primary subject of the prompt (e.g., "Phoenix", "Zeus", "World Tree").

Analyze the following prompt:
---
{{{promptText}}}
---

Return the result in the specified JSON format.
`,
});

const extractDetailsFlow = ai.defineFlow(
  {
    name: 'extractDetailsFlow',
    inputSchema: ExtractDetailsInputSchema,
    outputSchema: ExtractDetailsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
