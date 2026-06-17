import "dotenv/config";
import DodoPayments from "dodopayments";

const dodoPayments = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY || "dummy",
  environment: (process.env.DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode") || "test_mode",
});

async function run() {
  console.log("Calling customers.list with environment:", process.env.DODO_PAYMENTS_ENVIRONMENT || "test_mode");
  try {
    const res = await dodoPayments.customers.list({ email: "dev@example.com" });
    console.log("Result keys:", Object.keys(res));
    console.log("Full Result:", JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.error("Error calling customers.list:", err.message || err);
  }
}

run();
