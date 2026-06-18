import 'dotenv/config';
import { corsair } from './corsair';

const CALENDAR_TENANT_ID = "LGPiRmXjaI4SeEr3Rxq5vCrKBIBf4MAM_1781702298645";

async function main() {
  const calendarTenant = corsair.withTenant(CALENDAR_TENANT_ID);
  
  const tokenBefore = await calendarTenant.googlecalendar.keys.get_access_token();
  console.log("Token before getMany:", tokenBefore ? tokenBefore.substring(0, 15) + "..." : null);
  console.log("Token before length:", tokenBefore?.length);

  console.log("Running getMany...");
  try {
    const res = await calendarTenant.googlecalendar.api.events.getMany({ maxResults: 1 });
    console.log("getMany succeeded! Items count:", res?.items?.length);
  } catch (err) {
    console.error("getMany failed:", err);
  }

  const tokenAfter = await calendarTenant.googlecalendar.keys.get_access_token();
  console.log("Token after getMany:", tokenAfter ? tokenAfter.substring(0, 15) + "..." : null);
  console.log("Token after length:", tokenAfter?.length);
  
  console.log("Are they identical?", tokenBefore === tokenAfter);
}

main().catch(console.error).finally(() => process.exit(0));
