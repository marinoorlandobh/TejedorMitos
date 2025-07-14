import { config } from 'dotenv';
config();

// Dynamically import flows to improve startup time and reduce memory usage.
// This is especially helpful in a development environment.
import('genkit/dev-plugins').then(plugins => plugins.startDevServer({
  // You can specify your Genkit configuration here if it's not in the default location.
}));

// The individual flow imports are no longer needed here, as the dev server
// will automatically discover them based on the file structure.
// This assumes your flows are located in the conventional `src/ai/flows` directory.

