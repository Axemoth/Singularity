import 'dotenv/config';
import { createCorsair } from 'corsair';
import { gmail } from '@corsair-dev/gmail';     
import { googlecalendar } from '@corsair-dev/googlecalendar';    
import {conn} from './db/index';
import { classifyAndSaveEmail } from './api/tasks/prioritizer';


if (!process.env.CORSAIR_KEK) {
  throw new Error("CORSAIR_KEK environment variable is required. Set it in your .env file.");
}

export const corsair = createCorsair({
    plugins: [
        gmail({
            authType: "oauth_2",
            webhookHooks: {
                messageChanged: {
                    after: async (ctx, response) => {
                        if (response.success && response.data?.type === 'messageReceived') {
                            const message = response.data.message;
                            const entityId = response.corsairEntityId;
                            if (ctx.tenantId && entityId && message) {
                                await classifyAndSaveEmail(ctx.tenantId, entityId, message);
                            }
                        }
                    }
                }
            }
        }),
        googlecalendar({
            authType: "oauth_2"
        })
    ],
    database: conn,
    kek: process.env.CORSAIR_KEK!,
    multiTenancy: true,
});