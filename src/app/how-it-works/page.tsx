import Link from "next/link";
import { InfoPage } from "@/components/InfoPage";

export default function HowItWorksPage() {
  return (
    <InfoPage title="How it works" description="From your closet to your mirror in four steps.">
      <ol>
        <li>
          <strong>Add your clothes.</strong> Take a photo of one piece or a few laid out together. Virm finds each piece and
          labels it: what it is, its colour, season and how it&apos;s worn. New accounts start with 20 sample pieces.
        </li>
        <li>
          <strong>Pick your pieces.</strong> In the Studio, tap clothes from your closet, or type a theme like &ldquo;rainy day in
          Paris&rdquo; and get three outfit ideas from what you own.
        </li>
        <li>
          <strong>Add a full-body photo.</strong> One photo, head to toe, facing forward. Only you can see it, and you can change
          or remove it any time.
        </li>
        <li>
          <strong>Try it on.</strong> Virm layers the whole outfit onto your photo in one go: jacket over sweater, skirt, boots.
          Save the looks you like.
        </li>
      </ol>
      <h2>Good to know</h2>
      <ul>
        <li>Try-ons are AI-generated previews. They take about 10–20 seconds.</li>
        <li>Clear, well-lit photos on a plain background give the best results.</li>
        <li>
          See what happens with your photos in our <Link href="/privacy">privacy policy</Link>.
        </li>
      </ul>
    </InfoPage>
  );
}
