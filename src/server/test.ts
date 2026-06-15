import 'dotenv/config';
import { appRouter } from './api/root';
import { db } from './db';

async function run() {
  // Mock tRPC context for a logged-in user ('B2BoitqmY4LkfORFFeyEM3P2kYKT3PGO')
  const caller = appRouter.createCaller({
    headers: new Headers(),
    db,
    session: {
      user: {
        id: 'B2BoitqmY4LkfORFFeyEM3P2kYKT3PGO',
        name: 'Dev User',
        email: 'dev@example.com',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      session: {
        id: 'mock-session',
        token: 'mock-token',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'B2BoitqmY4LkfORFFeyEM3P2kYKT3PGO'
      }
    }
  });

  console.log('Calling caller.agent.chat...');
  try {
    const res = await caller.agent.chat({
      message: 'Hello, what should I handle first?',
      context: { route: '/inbox' }
    });
    console.log('Chat Succeeded:', res);
  } catch (err: any) {
    console.error('Chat Failed with Error:', err);
    if (err.cause) {
      console.error('Error Cause:', err.cause);
    }
  }
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});