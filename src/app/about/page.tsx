import Link from "next/link";
import { InfoPage } from "@/components/InfoPage";

export default function AboutPage() {
  return (
    <InfoPage title="About Virm" description="A virtual mirror for the clothes you already own.">
      <p>
        Most of us own more good outfits than we wear. Virm helps you see them. Add photos of your clothes, put
        outfits together yourself or let the stylist suggest some, and see them on your own full-body photo before
        you get dressed.
      </p>
      <h2>What we care about</h2>
      <ul>
        <li>
          <strong>Your closet stays yours.</strong> Your full-body photo and try-ons are private to you. We don&apos;t sell
          your data or show it to advertisers.
        </li>
        <li>
          <strong>Use what you own.</strong> Virm styles from your closet, not a shop.
        </li>
        <li>
          <strong>Honest previews.</strong> Try-ons are AI images. Fit and colour can differ from the real thing.
        </li>
      </ul>
      <p>
        Read <Link href="/how-it-works">how it works</Link> or our <Link href="/privacy">privacy policy</Link>.
      </p>
    </InfoPage>
  );
}
