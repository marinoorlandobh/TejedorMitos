import { config } from 'dotenv';
config();

import '@/ai/flows/reimagine-uploaded-image.ts';
import '@/ai/flows/analyze-uploaded-image.ts';
import '@/ai/flows/generate-myth-image.ts';
import '@/ai/flows/extract-mythologies-flow.ts';
import '@/ai/flows/extract-details-from-prompt.ts';
import '@/ai/flows/fix-image-prompt.ts';
import '@/ai/flows/translate-text-flow.ts';
