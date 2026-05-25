import Stripe from "stripe";

const isProduction = process.env.NODE_ENV === "production";

const useTestMode = !isProduction && process.env.STRIPE_TEST_MODE === "true";

console.log(`[stripe] mode: ${useTestMode ? "TEST" : "LIVE"} (isProduction=${isProduction}, STRIPE_TEST_MODE=${process.env.STRIPE_TEST_MODE})`);

async function getCredentials() {
  if (useTestMode && process.env.STRIPE_TEST_SECRET_KEY && process.env.STRIPE_TEST_PUBLISHABLE_KEY) {
    return {
      secretKey: process.env.STRIPE_TEST_SECRET_KEY,
      publishableKey: process.env.STRIPE_TEST_PUBLISHABLE_KEY,
    };
  }

  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY) {
    return {
      secretKey: process.env.STRIPE_SECRET_KEY,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    };
  }

  throw new Error(
    "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY environment variables."
  );
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    apiVersion: "2025-11-17.clover",
  });
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export { isProduction };
