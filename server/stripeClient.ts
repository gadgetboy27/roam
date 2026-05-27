import Stripe from "stripe";

const isProduction = process.env.NODE_ENV === "production";

const useTestMode = !isProduction && process.env.STRIPE_TEST_MODE === "true";

console.log(`[stripe] mode: ${useTestMode ? "TEST" : "LIVE"} (isProduction=${isProduction}, STRIPE_TEST_MODE=${process.env.STRIPE_TEST_MODE})`);

function getSecretKey(): string {
  if (useTestMode && process.env.STRIPE_TEST_SECRET_KEY) {
    return process.env.STRIPE_TEST_SECRET_KEY;
  }
  if (process.env.STRIPE_SECRET_KEY) {
    return process.env.STRIPE_SECRET_KEY;
  }
  throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.");
}

export function getUncachableStripeClient() {
  const secretKey = getSecretKey();
  return new Stripe(secretKey, {
    apiVersion: "2025-11-17.clover",
  });
}

export { isProduction };
