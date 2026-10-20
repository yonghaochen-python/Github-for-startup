import Link from "next/link";
import { InfoPage } from "@/components/InfoPage";
import { CONTACT_EMAIL, POLICY_UPDATED } from "@/lib/site";

export default function TermsPage() {
  return (
    <InfoPage title="Terms of Use" description={`Last updated: ${POLICY_UPDATED}`}>
      <p>By using Virm you agree to these terms. They&apos;re written to be read.</p>

      <h2>Your account</h2>
      <ul>
        <li>You need to be at least 13 to use Virm.</li>
        <li>Keep your password to yourself. You&apos;re responsible for what happens in your account.</li>
      </ul>

      <h2>Your photos and clothes</h2>
      <ul>
        <li>Everything you upload stays yours.</li>
        <li>
          You let us store and process it only to run Virm for you, as described in our <Link href="/privacy">privacy policy</Link>.
        </li>
        <li>Only upload photos you have the right to use. Don&apos;t upload photos of other people without their permission.</li>
      </ul>

      <h2>Fair use</h2>
      <p>Don&apos;t use Virm for anything illegal, harmful or sexual, or to impersonate someone, or to try to break or overload it.</p>

      <h2>AI results</h2>
      <p>
        Outfit suggestions and try-on pictures are made by AI. They&apos;re previews: fit, colour and detail can differ from the
        real clothes. Use your own judgement.
      </p>

      <h2>The service</h2>
      <ul>
        <li>Virm is provided as it is. We may change features, limit use, or pause the service.</li>
        <li>We may close accounts that break these terms.</li>
        <li>You can stop any time and delete your account from Profile.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </InfoPage>
  );
}
