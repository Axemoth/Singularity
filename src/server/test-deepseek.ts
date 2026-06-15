import 'dotenv/config';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

const deepseek = createOpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY ?? '',
});

async function run() {
  console.log('Testing deepseek-v4-pro...');
  try {
    const response = await generateText({
      model: (deepseek as any).chat('deepseek-v4-pro', {
        extraBody: {
          thinking: { type: 'enabled' },
          reasoning_effort: 'high',
        },
      }),
      prompt: 'Hello! Please output a short 5-word confirmation message.',
    });
    console.log('Success!', response.text);
  } catch (err: any) {
    console.error('Failed to run deepseek-v4-pro:', err.message || err);
  }
}

run();
