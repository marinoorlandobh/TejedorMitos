
'use server';
/**
 * @fileOverview A unified flow for batch creation. It extracts details and generates an image from a single prompt.
 * This is designed to be called for each item in a batch job from the client.
 *
 * - createMythFromBatch - The main function that handles the entire process for one item.
 * - CreateMythFromBatchInput - The input type for the function.
 * - CreateMythFromBatchOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { generateMythImage } from './generate-myth-image';

// Input is the same as GenerateMythImageInput, as the client provides all parameters
const CreateMythFromBatchInputSchema = z.object({
  culture: z.string(),
  entity: z.string(), // Will be empty, derived inside the flow
  details: z.string(),
  style: z.string(),
  aspectRatio: z.string(),
  imageQuality: z.string(),
  provider: z.string(), // google-ai or stable-diffusion
  checkpoint: z.string().optional(),
});
export type CreateMythFromBatchInput = z.infer<typeof CreateMythFromBatchInputSchema>;

// Output needs to include the generated image, the prompt, and the extracted name/entity
const CreateMythFromBatchOutputSchema = z.object({
  imageUrl: z.string().describe('The generated image as a data URI.'),
  prompt: z.string().describe('The full prompt used to generate the image.'),
  name: z.string().describe('The extracted name for the creation.'),
  entity: z.string().describe('The extracted entity for the creation.'),
});
export type CreateMythFromBatchOutput = z.infer<typeof CreateMythFromBatchOutputSchema>;


const extractDetailsPrompt = ai.definePrompt({
    name: 'extractDetailsForBatchPrompt',
    input: { schema: z.object({ promptText: z.string() }) },
    output: { schema: z.object({
        creationName: z.string().describe('A short, evocative name for the creation (2-5 words).'),
        entity: z.string().describe('The primary subject or theme of the prompt (1-3 words).'),
    })},
    prompt: `From the following image generation prompt, extract a concise, evocative name for the creation (creationName) and the main subject/theme (entity).

    - The creationName should be 2-5 words.
    - The entity should be the single primary subject (1-3 words).

    Prompt:
    ---
    {{{promptText}}}
    ---
    `,
});

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function createMythFromBatch(input: CreateMythFromBatchInput): Promise<CreateMythFromBatchOutput> {
    
    let name = `Creación en Lote`;
    let entity = 'Desconocido';
    let extractionSuccess = false;

    // First attempt to extract details
    try {
        const { output: extractedDetails } = await extractDetailsPrompt({ promptText: input.details });
        if (extractedDetails) {
            name = extractedDetails.creationName;
            entity = extractedDetails.entity;
            extractionSuccess = true;
        }
    } catch (e) {
        console.warn(`Initial detail extraction failed for prompt: "${input.details}". Error: ${e}`);
    }

    // If first attempt failed, wait 10 seconds and retry
    if (!extractionSuccess) {
        console.log(`Retrying detail extraction in 10 seconds for prompt: "${input.details}"`);
        await delay(10000); // 10 second delay
        try {
            const { output: extractedDetails } = await extractDetailsPrompt({ promptText: input.details });
            if (extractedDetails) {
                name = extractedDetails.creationName;
                entity = extractedDetails.entity;
                extractionSuccess = true;
                console.log(`Retry successful for prompt: "${input.details}"`);
            }
        } catch (e) {
            console.error(`Retry for detail extraction also failed for prompt: "${input.details}". Using fallback names. Error: ${e}`);
        }
    }
    
    // If both attempts failed, use fallback names
    if (!extractionSuccess) {
        // The first few words of the prompt can serve as a fallback entity.
        entity = input.details.split(' ').slice(0, 3).join(' ');
    }
    
    // Now, generate the image using the extracted/fallback entity.
    const imageGenerationInput = { ...input, entity: entity };
    const { imageUrl, prompt: finalPrompt } = await generateMythImage(imageGenerationInput);

    return {
        imageUrl,
        prompt: finalPrompt,
        name,
        entity,
    };
}
