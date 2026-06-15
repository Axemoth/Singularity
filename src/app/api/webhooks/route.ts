import { processWebhook } from 'corsair';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { corsair } from '@/server/corsair';
import { z } from 'zod';

export async function POST(request: NextRequest) {
	const headers: Record<string, string> = {};
	request.headers.forEach((value, key) => {
		headers[key] = value;
	});

	const contentType = request.headers.get('content-type');

	let body: string | Record<string, unknown>;

	if (contentType?.includes('application/json')) {
		body = await request.json();
	} else {
		const text = await request.text();
		body = text && text.trim() ? text : {};
	}

	const { searchParams } = new URL(request.url);
	let tenantId = searchParams.get('tenantId');

	// Decode target email from Google Pub/Sub payload and resolve tenantId if not provided in URL
	if (!tenantId || tenantId === 'dev') {
		if (
			body &&
			typeof body === 'object' &&
			'message' in body &&
			body.message &&
			typeof body.message === 'object' &&
			'data' in body.message &&
			typeof body.message.data === 'string'
		) {
			try {
				const dataStr = Buffer.from(body.message.data, 'base64').toString('utf8');
				const pubsubData = JSON.parse(dataStr) as { emailAddress?: string };
				const emailAddress = pubsubData.emailAddress;

				if (emailAddress) {
					const emailSchema = z.string().email();
					const parseResult = emailSchema.safeParse(emailAddress);
					if (parseResult.success) {
						const validatedEmail = parseResult.data;
						const { db } = await import("@/server/db");
						const { corsairAccounts } = await import("@/server/db/schema");
						const { eq } = await import("drizzle-orm");

						const accountRow = await db.query.corsairAccounts.findFirst({
							where: eq(corsairAccounts.emailAddress, validatedEmail),
						});

						if (accountRow) {
							tenantId = accountRow.tenantId;
							console.info(`[Webhook] Resolved tenantId "${tenantId}" from Gmail Pub/Sub emailAddress "${validatedEmail}"`);
						} else {
							console.warn(`[Webhook] No tenant account found matching emailAddress "${validatedEmail}"`);
						}
					} else {
						console.error(`[Webhook] Invalid email address format received in Pub/Sub payload:`, emailAddress);
					}
				}
			} catch (err) {
				console.error('[Webhook] Failed to resolve tenantId from Pub/Sub payload:', err);
			}
		}
	}

	if (!tenantId) {
		tenantId = 'dev';
	}

	const result = await processWebhook(corsair, headers, body, { tenantId });

	console.info('Plugin Processed:', result.plugin, result.action);

	// Build response headers (e.g. Asana X-Hook-Secret handshake)
	// any/unknown cast needed since responseHeaders is a newer field not yet in the installed type definitions
	const responseHeaders = result.responseHeaders
	const nextHeaders = new Headers();
	if (responseHeaders) {
		for (const [key, value] of Object.entries(responseHeaders)) {
			nextHeaders.set(key, value);
		}
	}

	// Handle case where no webhook matched
	if (!result.response) {
		return NextResponse.json(
			{
				success: false,
				message: 'No matching webhook handler found',
			},
			{ status: 404 },
		);
	}

	if (result.response !== undefined) {
		return NextResponse.json(result.response, { headers: nextHeaders });
	}

	// Webhook processed successfully, but no data to return to sender
	return new NextResponse(null, { status: 200, headers: nextHeaders });
}

export async function GET() {
	return NextResponse.json({
		status: 'ok',
		message: 'Webhook endpoint is active',
		timestamp: new Date().toISOString(),
	});
}