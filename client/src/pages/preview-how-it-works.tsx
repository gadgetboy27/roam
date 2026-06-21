import { useLocation } from "wouter";
import HowItWorks from "@/components/how-it-works";

// Public, unlisted preview of the "See how it works" explainer — so it can be
// opened directly (no logging out) and screen-recorded for ads/social.
// Route: /preview/how-it-works
export default function PreviewHowItWorks() {
  const [, navigate] = useLocation();
  return (
    <HowItWorks
      open
      onClose={() => navigate("/")}
      onSeeEvents={() => navigate("/")}
    />
  );
}
