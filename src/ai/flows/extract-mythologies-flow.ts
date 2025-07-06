'use server';

/**
 * @fileOverview Extracts mythological themes and prompts from text.
 *
 * - extractMythologiesFromText - A function that handles the text extraction process.
 * - ExtractMythologiesInput - The input type for the function.
 * - ExtractMythologiesOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { MYTHOLOGICAL_CULTURES } from '@/lib/types';

const ExtractMythologiesInputSchema = z.object({
  text: z.string().describe('The text content from which to extract information.'),
});
export type ExtractMythologiesInput = z.infer<typeof ExtractMythologiesInputSchema>;

const MythologySchema = z.object({
    mythologyName: z.string().describe('The name of the mythological culture or theme, e.g., "Griega", "Nórdica". This should match one of the available cultures when possible.'),
    prompts: z.array(z.string()).describe('A list of detailed, creative image generation prompts related to the mythology.')
});

const ExtractMythologiesOutputSchema = z.object({
  extractedData: z.array(MythologySchema).describe('An array of extracted mythologies and their associated prompts.'),
});
export type ExtractMythologiesOutput = z.infer<typeof ExtractMythologiesOutputSchema>;

export async function extractMythologiesFromText(input: ExtractMythologiesInput): Promise<ExtractMythologiesOutput> {
  return extractMythologiesFlow(input);
}

const availableCultures = MYTHOLOGICAL_CULTURES.filter(c => c !== 'Personalizada').join(', ');

const prompt = ai.definePrompt({
  name: 'extractMythologiesPrompt',
  input: {schema: ExtractMythologiesInputSchema},
  output: {schema: ExtractMythologiesOutputSchema},
  prompt: `You are an expert in world mythology and a creative writer specializing in generating image prompts.
Your task is to analyze the following text and extract key mythological themes, cultures, or entities.
For each distinct mythology you identify, you must set the 'mythologyName' and generate a list of 3 to 5 detailed, creative prompts suitable for an AI image generator.

**Crucially, the 'mythologyName' MUST match one of the following available cultures if the theme corresponds to one:**
[${availableCultures}]

If a theme in the text does not directly match one of the provided cultures, you can use a more descriptive name (e.g., "Monstruos Cósmicos"), but always prefer one from the list if applicable. The prompts should be inspired by the text but elaborated for visual richness.

Example: If the text mentions "Zeus throwing a lightning bolt", since "Griega" is an available culture, the 'mythologyName' MUST be "Griega". A good prompt would be "Epic oil painting of Zeus on Mount Olympus, dark storm clouds gathering, hurling a crackling lightning bolt towards the earth, glowing eyes, powerful stance, cinematic lighting."

Analyze the following text:
---
{{{text}}}
---

Return the result in the specified JSON format, ensuring 'mythologyName' adheres to the rules above.
`,
});

const extractMythologiesFlow = ai.defineFlow(
  {
    name: 'extractMythologiesFlow',
    inputSchema: ExtractMythologiesInputSchema,
    outputSchema: ExtractMythologiesOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
