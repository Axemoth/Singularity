import "dotenv/config";
import { setupCorsair } from "corsair";
import { corsair } from "./corsair";

async function main() {
  console.log("Initializing Corsair integrations setup...");
  try {
    // 1. Run setupCorsair to initialize integrations and create account DEKs if needed
    await setupCorsair(corsair);
    console.log("Corsair schema structure successfully set up in database.");

    // 2. Register shared OAuth application credentials for Google integrations
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!googleClientId || !googleClientSecret) {
      throw new Error(
        "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables."
      );
    }

    console.log("Registering Gmail client credentials...");
    await corsair.keys.gmail.set_client_id(googleClientId);
    await corsair.keys.gmail.set_client_secret(googleClientSecret);

    console.log("Registering Google Calendar client credentials...");
    await corsair.keys.googlecalendar.set_client_id(googleClientId);
    await corsair.keys.googlecalendar.set_client_secret(googleClientSecret);

    console.log("All Corsair integration credentials seeded successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Failed to seed Corsair integrations:", err);
    process.exit(1);
  }
}

void main();
