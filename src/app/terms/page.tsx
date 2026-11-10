import Link from "next/link";
import { InfoPage } from "@/components/InfoPage";
import { CONTACT_EMAIL, POLICY_UPDATED, billingIsOn } from "@/lib/site";
import { INVITE_TRIAL_ALLOWANCES, INVITE_TRIAL_DAYS, PLAN_ALLOWANCES, TRIAL_ALLOWANCES } from "@/lib/plans";

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

      {billingIsOn() && (
        <>
          <h2>Plans</h2>
          <ul>
            <li>
              <strong>Free</strong> costs nothing. <strong>VIRM Plus</strong> costs $14.99 (US dollars) a month. Both include every Virm
              feature; Plus has bigger monthly allowances ({PLAN_ALLOWANCES.plus.photo} photo try-ons, {PLAN_ALLOWANCES.plus.live} live try-ons,{" "}
              {PLAN_ALLOWANCES.plus.closet} clothing photos and {PLAN_ALLOWANCES.plus.style} Style It searches a month).
            </li>
            <li>
              Allowances reset each month. On Plus, unused photo and live try-ons carry over to the next month only (up to one month&apos;s
              worth: {PLAN_ALLOWANCES.plus.photo} photo and {PLAN_ALLOWANCES.plus.live} live), are used first, and end if Plus ends. Other
              unused allowances don&apos;t carry over.
            </li>
            <li>Payments are handled by Stripe. Virm never sees or stores your card details.</li>
          </ul>

          <h2>The Plus trial</h2>
          <ul>
            <li>One free trial per person, for 7 days. To start it you add a card, which Stripe saves. $0 is charged.</li>
            <li>
              The trial includes {TRIAL_ALLOWANCES.photo} photo try-ons, {TRIAL_ALLOWANCES.live} live try-ons (at most one a day), {TRIAL_ALLOWANCES.report} AI
              Stylist reports, {TRIAL_ALLOWANCES.closet} clothing photo additions with AI tagging and {TRIAL_ALLOWANCES.style} Style It searches. Trial
              credits end when the trial ends.
            </li>
            <li>
              With a friend&apos;s invite code, entered before your trial starts, the trial is {INVITE_TRIAL_DAYS} days and includes{" "}
              {INVITE_TRIAL_ALLOWANCES.photo} photo try-ons, {INVITE_TRIAL_ALLOWANCES.live} live try-ons (at most one a day),{" "}
              {INVITE_TRIAL_ALLOWANCES.report} AI Stylist reports, {INVITE_TRIAL_ALLOWANCES.closet} clothing photo additions and{" "}
              {INVITE_TRIAL_ALLOWANCES.style} Style It searches. A code can be used once per new account, not on your own account, and
              gives nothing to the person who shared it.
            </li>
            <li>
              <strong>There is no automatic charge when the trial ends.</strong> Your account goes back to Free unless you choose to continue
              with Plus.
            </li>
          </ul>

          <h2>Plus</h2>
          <ul>
            <li>
              Plus starts only when you confirm it. You&apos;re charged $14.99 then, and again every month on the same date until you cancel.
            </li>
            <li>
              You can cancel any time from <Link href="/profile">Profile</Link> (Manage Plus). Plus keeps working until the end of the month
              you&apos;ve paid for, and you won&apos;t be charged again. Payments already made aren&apos;t refunded for part of a month, except
              where the law requires it.
            </li>
            <li>If a monthly payment fails, we&apos;ll ask you to update your card. If it still can&apos;t be paid, Plus ends.</li>
            <li>If the price ever changes, we&apos;ll tell you at least 30 days before it applies to you, and you can cancel before then.</li>
            <li>Deleting your account ends Plus straight away, with no further charges.</li>
          </ul>
        </>
      )}

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
