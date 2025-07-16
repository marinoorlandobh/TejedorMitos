
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

// Input is similar to GenerateMythImageInput, but 'entity' is derived inside the flow.
const CreateMythFromBatchInputSchema = z.object({
  culture: z.string(),
  details: z.string(),
  style: z.string(),
  aspectRatio: z.string(),
  imageQuality: z.string(),
  provider: z.string(), // 'google-ai' or 'stable-diffusion'
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

async function generateWithGoogleAI(prompt: string) {
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: prompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        safetySettings: [
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_ONLY_HIGH',
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_ONLY_HIGH',
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
        ],
      },
    });

    if (!media?.url) {
      throw new Error(
        "La generación de imagen falló, probablemente por infringir las políticas de seguridad del modelo. Esto puede ocurrir con escenas de batalla o desnudos artísticos. Intenta usar la opción 'Corregir con IA' para reescribir el prompt o modifícalo manualmente para que sea más descriptivo y menos explícito."
      );
    }
    return media.url;
}

export async function createMythFromBatch(input: CreateMythFromBatchInput): Promise<CreateMythFromBatchOutput> {
    
    // First, construct the full prompt that will be used for both name extraction and image generation.
    const fullPrompt = `A visually rich image in the style of ${input.style}. The primary subject is from ${input.culture} mythology. Key scene details include: ${input.details}. The desired image quality is ${input.imageQuality}.`;

    let name = `Creación en Lote`;
    let entity = 'Desconocido';
    let extractionSuccess = false;

    // Attempt to extract details using the full, rich prompt.
    try {
        const { output: extractedDetails } = await extractDetailsPrompt({ promptText: fullPrompt });
        if (extractedDetails) {
            name = extractedDetails.creationName;
            entity = extractedDetails.entity;
            extractionSuccess = true;
        }
    } catch (e) {
        console.warn(`Initial detail extraction failed for prompt: "${fullPrompt}". Error: ${e}`);
    }

    // If first attempt failed, wait 10 seconds and retry
    if (!extractionSuccess) {
        console.log(`Retrying detail extraction in 10 seconds for prompt: "${fullPrompt}"`);
        await delay(10000); // 10 second delay
        try {
            const { output: extractedDetails } = await extractDetailsPrompt({ promptText: fullPrompt });
            if (extractedDetails) {
                name = extractedDetails.creationName;
                entity = extractedDetails.entity;
                extractionSuccess = true;
                console.log(`Retry successful for prompt: "${fullPrompt}"`);
            }
        } catch (e) {
            console.error(`Retry for detail extraction also failed for prompt: "${fullPrompt}". Using fallback names. Error: ${e}`);
        }
    }
    
    // If both attempts failed, use fallback names
    if (!extractionSuccess) {
        // The first few words of the prompt can serve as a fallback entity.
        entity = input.details.split(' ').slice(0, 3).join(' ');
    }
    
    // Now, generate the image using the full prompt.
    // This server flow now only handles Google AI for the batch process. SD is handled client-side and doesn't use this flow.
    const imageUrl = await generateWithGoogleAI(fullPrompt);

    return {
        imageUrl,
        prompt: fullPrompt,
        name,
        entity,
    };
}
