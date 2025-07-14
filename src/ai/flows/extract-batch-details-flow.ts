'use server';

/**
 * @fileOverview Extracts creation names and entities from a batch of prompt texts.
 *
 * - extractBatchDetailsFromPrompts - A function that handles the batch detail extraction process.
 * - ExtractBatchDetailsInput - The input type for the function.
 * - ExtractBatchDetailsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const ExtractBatchDetailsInputSchema = z.object({
  prompts: z.array(z.string()).describe('An array of image generation prompts from which to extract details.'),
});
export type ExtractBatchDetailsInput = z.infer<typeof ExtractBatchDetailsInputSchema>;

const DetailSchema = z.object({
  creationName: z.string().describe('A short, evocative name for the creation, suitable for a gallery title (e.g., "The Serpent of Ashes", "Cybernetic Griffin"). Should be 2-5 words.'),
  entity: z.string().describe('The primary subject, character, or theme of the prompt (e.g., "Phoenix", "Zeus", "World Tree"). Should be a single noun or a short phrase.'),
});

const ExtractBatchDetailsOutputSchema = z.object({
    details: z.array(DetailSchema).describe('An array of extracted name/entity pairs, corresponding to the input prompts array.'),
});
export type ExtractBatchDetailsOutput = z.infer<typeof ExtractBatchDetailsOutputSchema>;


export async function extractBatchDetailsFromPrompts(input: ExtractBatchDetailsInput): Promise<ExtractBatchDetailsOutput> {
  return extractBatchDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractBatchDetailsPrompt',
  input: {schema: ExtractBatchDetailsInputSchema},
  output: {schema: ExtractBatchDetailsOutputSchema},
  prompt: `You are an expert in summarizing creative text. For each image generation prompt in the following list, extract a concise, evocative name for the creation (creationName) and the main subject or theme (entity).

The creationName should be short and suitable for a gallery title (e.g., "The Serpent of Ashes", "Cybernetic Griffin"). It should be 2-5 words.
The entity should be the single primary subject of the prompt (e.g., "Phoenix", "Zeus", "World Tree").

Analyze the following list of prompts:
---
{{#each prompts}}
- "{{this}}"
{{/each}}
---

Return a single JSON object containing a 'details' array. Each element in the array must be an object with 'creationName' and 'entity', corresponding to each prompt in the input list. The order and number of elements in your output array MUST match the input array.
`,
});

const extractBatchDetailsFlow = ai.defineFlow(
  {
    name: 'extractBatchDetailsFlow',
    inputSchema: ExtractBatchDetailsInputSchema,
    outputSchema: ExtractBatchDetailsOutputSchema,
  },
  async (input) => {
    if (!input.prompts || input.prompts.length === 0) {
      return { details: [] };
    }
    const {output} = await prompt(input);
    if (!output || output.details.length !== input.prompts.length) {
      throw new Error("La IA no pudo extraer los detalles para todos los prompts. Asegúrate de que los prompts no sean ambiguos.");
    }
    return output;
  }
);
