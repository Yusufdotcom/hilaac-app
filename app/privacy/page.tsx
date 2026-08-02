import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy - Hilaac",
  description:
    "How Hilaac collects, uses, and protects restaurant and customer data on the Hilaac Smart Solution platform.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell title="Privacy Policy" lastUpdated="August 3, 2026">
      <LegalSection title="1. Introduction">
        <p>
          Hilaac Smart Solution (&quot;Hilaac,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
          operates the Hilaac restaurant SaaS platform at{" "}
          <a href="https://hilaacapp.so" className="font-medium text-[#D4A373] hover:underline">
            hilaacapp.so
          </a>
          . This Privacy Policy explains what information we collect, how we use it, and the
          choices you have. By using Hilaac, you agree to the practices described here.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <p>Depending on how you use Hilaac, we may collect:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-medium text-[#0F172A]">Account details:</span> name, email
            address, and authentication data (including when you sign in with Google).
          </li>
          <li>
            <span className="font-medium text-[#0F172A]">Restaurant details:</span> restaurant
            name, address, phone numbers, branding, menu items, tables, and staff profiles.
          </li>
          <li>
            <span className="font-medium text-[#0F172A]">Order history:</span> orders placed
            through QR ordering, payment status, table or takeaway identifiers, and related
            operational notes needed to fulfill service.
          </li>
          <li>
            <span className="font-medium text-[#0F172A]">Customer contact data:</span> phone
            numbers customers provide for order updates, loyalty, or WhatsApp notifications,
            when enabled by the restaurant.
          </li>
          <li>
            <span className="font-medium text-[#0F172A]">Technical data:</span> basic logs such
            as IP address, device/browser type, and timestamps used for security and
            reliability.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How we use information">
        <p>We use the information we collect to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Operate the platform and process dine-in and takeaway orders.</li>
          <li>Send order status updates, receipts, and service-related notifications.</li>
          <li>Provide admin, kitchen, waiter, and cashier tools for your restaurant team.</li>
          <li>Bill subscriptions and manage account access.</li>
          <li>Improve reliability, prevent abuse, and enhance product features.</li>
          <li>
            Send optional marketing or re-engagement messages only where the restaurant and
            applicable consent rules allow it.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Data storage and security">
        <p>
          Hilaac stores application data with Supabase (hosted Postgres, Auth, Storage, and
          related services). Data is encrypted in transit (HTTPS/TLS) and encrypted at rest by
          our infrastructure providers. Sensitive payment merchant credentials, when stored,
          are encrypted at the application layer before persistence. Access is restricted using
          authentication, role-based permissions, and tenant isolation controls.
        </p>
      </LegalSection>

      <LegalSection title="5. Sharing of information">
        <p>
          We do not sell personal data. We share information only with service providers that
          help us run Hilaac (for example hosting, authentication, email delivery, SMS/WhatsApp
          providers, and payment gateways), and only as needed to provide those services; when
          required by law; or with your direction (for example, when a restaurant enables a
          third-party notification channel).
        </p>
      </LegalSection>

      <LegalSection title="6. Your rights and choices">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-medium text-[#0F172A]">Access and correction:</span> restaurant
            owners and managers can update account and restaurant profile information in the
            admin settings.
          </li>
          <li>
            <span className="font-medium text-[#0F172A]">Deletion:</span> you may request deletion
            of your account and associated restaurant data by contacting us. We will process
            requests subject to legal and operational retention needs (for example, billing
            records).
          </li>
          <li>
            <span className="font-medium text-[#0F172A]">Marketing opt-out:</span> customers can
            opt out of WhatsApp/marketing messages using provider STOP flows or by asking the
            restaurant to stop contact; restaurants can disable marketing features in settings.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Data retention">
        <p>
          We retain account, restaurant, and order data for as long as your account is active
          and as needed to provide the service, comply with law, resolve disputes, and enforce
          our agreements. When an account is closed and deletion is requested, we delete or
          anonymize personal data within a reasonable period unless retention is required.
        </p>
      </LegalSection>

      <LegalSection title="8. International processing">
        <p>
          Hilaac and its providers may process data in data centers outside your country.
          Where we do so, we rely on appropriate safeguards offered by our infrastructure and
          service partners.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. We will post the revised version
          on this page and update the &quot;Last updated&quot; date. Continued use of Hilaac
          after changes means you accept the updated policy.
        </p>
      </LegalSection>

      <LegalSection title="10. Contact">
        <p>
          For privacy questions or deletion requests, contact us at{" "}
          <a
            href="mailto:sales@hilaac.so"
            className="font-medium text-[#D4A373] hover:underline"
          >
            sales@hilaac.so
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
