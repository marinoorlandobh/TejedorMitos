'use server';

/**
 * @fileOverview Translates text to Spanish.
 *
 * - translateText - A function that handles the translation process.
 * - TranslateTextInput - The input type for the function.
 * - TranslateTextOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const TranslateTextInputSchema = z.object({
  text: z.string().describe('The text to be translated to Spanish.'),
});
export type TranslateTextInput = z.infer<typeof TranslateTextInputSchema>;

const TranslateTextOutputSchema = z.object({
  translatedText: z.string().describe('The translated Spanish text.'),
});
export type TranslateTextOutput = z.infer<typeof TranslateTextOutputSchema>;

export async function translateText(input: TranslateTextInput): Promise<TranslateTextOutput> {
  return translateTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'translateTextPrompt',
  input: {schema: TranslateTextInputSchema},
  output: {schema: TranslateTextOutputSchema},
  prompt: `Translate the following text to Spanish. Return only the translated text.
---
{{{text}}}
---
`,
});

const translateTextFlow = ai.defineFlow(
  {
    name: 'translateTextFlow',
    inputSchema: TranslateTextInputSchema,
    outputSchema: TranslateTextOutputSchema,
  },
  async (input) => {
    if (!input.text?.trim()) {
      return { translatedText: '' };
    }
    const {output} = await prompt(input);
    if (!output) {
      throw new Error("The AI could not translate the text.");
    }
    return output;
  }
);
