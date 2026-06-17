import DodoPayments from "dodopayments";

const dodoPayments = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY || "dummy",
  environment: "test_mode",
});

console.log("Subscriptions prototype methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(dodoPayments.subscriptions)));
console.log("Customers prototype methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(dodoPayments.customers)));
process.exit(0);
