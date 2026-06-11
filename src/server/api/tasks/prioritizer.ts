import { db } from "@/server/db";
import { emailPriorities } from "@/server/db/schema";

export async function classifyAndSaveEmail(tenantId: string, entityId: string, message: any) {
  console.log(`[Prioritizer] Placeholder triggered for tenant: ${tenantId}, entityId: ${entityId}`);
  // Full LLM logic will be implemented in Phase 7.
  return;
}
