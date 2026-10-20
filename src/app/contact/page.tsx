import { InfoPage } from "@/components/InfoPage";
import { CONTACT_EMAIL } from "@/lib/site";

export default function ContactPage() {
  return (
    <InfoPage title="Contact" description="We read every message.">
      <p>
        Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> for:
      </p>
      <ul>
        <li>Questions or feedback about Virm</li>
        <li>Help getting into your account</li>
        <li>Privacy requests: a copy of your data, or deleting it</li>
      </ul>
      <p>Please send it from the email you use for Virm, so we can find your account.</p>
    </InfoPage>
  );
}
