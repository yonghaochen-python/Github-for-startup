import Link from "next/link";
import { InfoPage } from "@/components/InfoPage";
import { CONTACT_EMAIL, POLICY_UPDATED } from "@/lib/site";

export default function PrivacyPage() {
  return (
    <InfoPage title="Privacy Policy" description={`Last updated: ${POLICY_UPDATED}`}>
      <p>
        Virm (&ldquo;we&rdquo;, &ldquo;our&rdquo;) is a virtual-mirror closet app. Your closet stays yours. This policy explains what we
        collect, why, and who helps us run Virm.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account info:</strong> your email address and password. Your password is stored as a one-way hash, so no one,
          including us, can read it. Your name is optional.
        </li>
        <li>
          <strong>Your photos and clothes:</strong> the full-body photo and clothing photos you upload, the details Virm records
          about each piece, the outfits you make, and the try-on pictures we create for you.
        </li>
        <li>
          <strong>Usage data:</strong> which pages you open, which features you use, when you were last active, and whether
          try-ons and outfit suggestions worked and how long they took. This is linked to your account. The owner&apos;s
          dashboard shows totals and partly hidden emails only, never your photos, clothes or password.
        </li>
      </ul>

      <h2>What we do with it</h2>
      <ul>
        <li>Run Virm: store your closet, suggest outfits and create your try-on pictures.</li>
        <li>Improve Virm using overall usage patterns.</li>
        <li>We do not sell your data. We do not share your photos or closet with advertisers.</li>
      </ul>

      <h2>Who helps us run Virm</h2>
      <p>We use these providers only to do what you ask. We send them only what each task needs:</p>
      <ul>
        <li>
          <strong>Cloudflare</strong> hosts Virm and stores your account, closet and photos.
        </li>
        <li>
          <strong>Black Forest Labs</strong> (FLUX) creates try-on pictures. When you press Try On, your full-body photo and
          that outfit&apos;s clothing photos are sent to them.
        </li>
        <li>
          <strong>Anthropic</strong> (Claude) recognises and describes clothes when you add a photo to your closet. It also
          suggests outfits, using the written descriptions of your clothes, not your photos.
        </li>
        <li>
          <strong>Decart</strong> powers live try-on. When you start an AI live session, your camera video and the outfit&apos;s
          clothing photos are sent to them for that session, up to 20 seconds.
        </li>
      </ul>

      <h2>Your photos</h2>
      <ul>
        <li>Your full-body photo and try-on pictures are private: only you can see them, after logging in.</li>
        <li>
          If you use Share looks, the two try-on pictures you choose can be seen by anyone with that link, for 48
          hours. Then the link ends and those copies are deleted. You can stop sharing sooner. Friends who vote don&apos;t
          need an account, and we don&apos;t record who they are.
        </li>
        <li>Clothing photos are stored at long, random web addresses that aren&apos;t listed anywhere or shown to other users.</li>
        <li>
          Live try-on is recorded in your browser so you can replay it. The recording isn&apos;t uploaded or kept unless you
          choose Save to Virm, Download or Share. Saved videos are private to you, and you can delete them any time in
          Saved Looks.
        </li>
        <li>We don&apos;t use your photos or videos to train AI models.</li>
      </ul>

      <h2>Keeping and deleting your data</h2>
      <ul>
        <li>We keep your data while you have an account.</li>
        <li>
          You can delete your account any time from <Link href="/profile">Profile</Link>. This permanently deletes your photos,
          clothes, try-ons, outfits, usage data and account straight away. Copies in our occasional backups are deleted
          within 30 days.
        </li>
        <li>
          To get a copy of your data, or for help deleting it, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </li>
      </ul>

      <h2>Security</h2>
      <p>
        We use encrypted connections (HTTPS) and one-way password hashing, and keep your full-body photo private. No method
        is 100% secure, but we treat your photos like they matter, because they do.
      </p>

      <h2>Children</h2>
      <p>Virm is not intended for children under 13.</p>

      <h2>Changes</h2>
      <p>If this policy changes, we&apos;ll update the date above and let you know in the app.</p>

      <h2>Contact</h2>
      <p>
        Questions about privacy: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </InfoPage>
  );
}
