import Stripe from "stripe";

const testKey = process.env.STRIPE_TEST_SECRET_KEY;
if (!testKey) {
  console.error("STRIPE_TEST_SECRET_KEY not set — aborting");
  process.exit(1);
}

const stripe = new Stripe(testKey, { apiVersion: "2025-08-27.basil" as any });
const BASE_URL = "http://localhost:5000";

async function run() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("STRIPE TEST MODE — real checkout sessions");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // 1. Adventurer subscription ($4.99 NZD/month)
  console.log("── CHECKOUT 1: Adventurer ($4.99 NZD/month) ──");
  const subSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    currency: "nzd",
    line_items: [{ price_data: { currency: "nzd", unit_amount: 499, recurring: { interval: "month" }, product_data: { name: "roam. Adventurer" } }, quantity: 1 }],
    success_url: `${BASE_URL}/profile?subscribed=1`,
    cancel_url: `${BASE_URL}/plans`,
    metadata: { userId: "test_user_demo", type: "subscription" },
  });
  console.log("  Status: CREATED ✓");
  console.log(`  URL:    ${subSession.url}`);
  console.log(`  ID:     ${subSession.id}\n`);

  // 2. Profile Boost ($1 NZD)
  console.log("── CHECKOUT 2: Profile Boost ($1.00 NZD) ──");
  const boostSession = await stripe.checkout.sessions.create({
    mode: "payment",
    currency: "nzd",
    line_items: [{ price_data: { currency: "nzd", unit_amount: 100, product_data: { name: "roam. Profile Boost (24h)" } }, quantity: 1 }],
    success_url: `${BASE_URL}/profile?boosted=1`,
    cancel_url: `${BASE_URL}/profile`,
    metadata: { userId: "test_user_demo", type: "boost" },
  });
  console.log("  Status: CREATED ✓");
  console.log(`  URL:    ${boostSession.url}`);
  console.log(`  ID:     ${boostSession.id}\n`);

  // 3. Squad Leader ($19.99 NZD one-time)
  console.log("── CHECKOUT 3: Squad Leader ($19.99 NZD) ──");
  const leaderSession = await stripe.checkout.sessions.create({
    mode: "payment",
    currency: "nzd",
    line_items: [{ price_data: { currency: "nzd", unit_amount: 1999, product_data: { name: "roam. Squad Leader" } }, quantity: 1 }],
    success_url: `${BASE_URL}/profile?leader=1`,
    cancel_url: `${BASE_URL}/plans`,
    metadata: { userId: "test_user_demo", type: "organiser" },
  });
  console.log("  Status: CREATED ✓");
  console.log(`  URL:    ${leaderSession.url}`);
  console.log(`  ID:     ${leaderSession.id}\n`);

  // 4. Check Stripe test balance (confirming test API is live)
  console.log("── STRIPE TEST API HEALTH ──");
  const balance = await stripe.balance.retrieve();
  console.log(`  Connected to Stripe: ✓`);
  console.log(`  Account currency:    ${balance.available[0]?.currency?.toUpperCase() ?? "NZD"}`);
  console.log(`  Livemode:            ${(balance as any).livemode ?? false}`);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Complete a purchase with test card: 4242 4242 4242 4242");
  console.log("Any future date, any CVC. Then watch the server logs.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

run().catch(err => { console.error("FAILED:", err.message); process.exit(1); });
