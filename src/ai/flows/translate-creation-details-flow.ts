'use server';

/**
 * @fileOverview Translates creation name and details to Spanish in a single call.
 *
 * - translateCreationDetails - A function that handles the translation process.
 * - TranslateCreationDetailsInput - The input type for the function.
 * - TranslateCreationDetailsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const TranslateCreationDetailsInputSchema = z.object({
  name: z.string().describe('The name of the creation to be translated to Spanish.'),
  details: z.string().describe('The descriptive details of the creation to be translated to Spanish.'),
});
export type TranslateCreationDetailsInput = z.infer<typeof TranslateCreationDetailsInputSchema>;

const TranslateCreationDetailsOutputSchema = z.object({
  translatedName: z.string().describe('The translated Spanish name.'),
  translatedDetails: z.string().describe('The translated Spanish details.'),
});
export type TranslateCreationDetailsOutput = z.infer<typeof TranslateCreationDetailsOutputSchema>;

export async function translateCreationDetails(input: TranslateCreationDetailsInput): Promise<TranslateCreationDetailsOutput> {
  return translateCreationDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'translateCreationDetailsPrompt',
  input: {schema: TranslateCreationDetailsInputSchema},
  output: {schema: TranslateCreationDetailsOutputSchema},
  prompt: `Translate the following creation name and its details to Spanish. Return only the translated text in the specified JSON format.

Name to translate:
---
{{{name}}}
---

Details to translate:
---
{{{details}}}
---
`,
});

const translateCreationDetailsFlow = ai.defineFlow(
  {
    name: 'translateCreationDetailsFlow',
    inputSchema: TranslateCreationDetailsInputSchema,
    outputSchema: TranslateCreationDetailsOutputSchema,
  },
  async (input) => {
    if (!input.name?.trim() && !input.details?.trim()) {
      return { translatedName: '', translatedDetails: '' };
    }
    const {output} = await prompt(input);
    if (!output) {
      throw new Error("The AI could not translate the text.");
    }
    return output;
  }
);
