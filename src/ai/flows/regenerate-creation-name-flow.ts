
'use server';

/**
 * @fileOverview Regenerates a creation name and entity from a given prompt text.
 * This is useful for fixing generic names that were created when batch processing failed.
 *
 * - regenerateCreationName - A function that handles the name regeneration process.
 * - RegenerateCreationNameInput - The input type for the function.
 * - RegenerateCreationNameOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

export const RegenerateCreationNameInputSchema = z.object({
  promptText: z.string().describe('The image generation prompt from which to extract a new name and entity.'),
});
export type RegenerateCreationNameInput = z.infer<typeof RegenerateCreationNameInputSchema>;

export const RegenerateCreationNameOutputSchema = z.object({
  creationName: z.string().describe('A short, evocative name for the creation, suitable for a gallery title (e.g., "The Serpent of Ashes", "Cybernetic Griffin"). Should be 2-5 words.'),
  entity: z.string().describe('The primary subject, character, or theme of the prompt (e.g., "Phoenix", "Zeus", "World Tree"). Should be a single noun or a short phrase.'),
});
export type RegenerateCreationNameOutput = z.infer<typeof RegenerateCreationNameOutputSchema>;

export async function regenerateCreationName(input: RegenerateCreationNameInput): Promise<RegenerateCreationNameOutput> {
  return regenerateCreationNameFlow(input);
}

const prompt = ai.definePrompt({
  name: 'regenerateCreationNamePrompt',
  input: {schema: RegenerateCreationNameInputSchema},
  output: {schema: RegenerateCreationNameOutputSchema},
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

const regenerateCreationNameFlow = ai.defineFlow(
  {
    name: 'regenerateCreationNameFlow',
    inputSchema: RegenerateCreationNameInputSchema,
    outputSchema: RegenerateCreationNameOutputSchema,
  },
  async (input) => {
    if (!input.promptText?.trim()) {
      throw new Error("El texto del prompt no puede estar vacío.");
    }
    const {output} = await prompt(input);
    if (!output) {
      throw new Error("La IA no pudo extraer un nombre y entidad válidos del prompt. Puede que sea demasiado ambiguo.");
    }
    return output;
  }
);
