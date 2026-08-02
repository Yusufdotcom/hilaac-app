import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "Terms of Service - Hilaac",
  description:
    "Terms governing use of the Hilaac Smart Solution restaurant SaaS platform.",
};

export default function TermsOfServicePage() {
  return (
    <LegalPageShell title="Terms of Service" lastUpdated="August 3, 2026">
      <LegalSection title="1. Acceptance of terms">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern access to and use of the Hilaac
          Smart Solution platform (&quot;Hilaac,&quot; &quot;Service&quot;) operated at{" "}
          <a href="https://hilaacapp.so" className="font-medium text-[#D4A373] hover:underline">
            hilaacapp.so
          </a>
          . By creating an account, starting a trial, or using Hilaac, you agree to these Terms
          on behalf of yourself and the restaurant or business you represent.
        </p>
      </LegalSection>

      <LegalSection title="2. The service">
        <p>
          Hilaac provides multi-tenant software for restaurants, including QR-based customer
          ordering, kitchen/waiter/cashier tools, admin configuration, reporting, and optional
          payment and messaging integrations. Features may vary by subscription plan. We may
          update, improve, or discontinue features with reasonable notice when practicable.
        </p>
      </LegalSection>

      <LegalSection title="3. Accounts and responsibilities">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            You must provide accurate registration information and keep credentials secure.
          </li>
          <li>
            <span className="font-medium text-[#0F172A]">Restaurant owners</span> are
            responsible for their staff accounts, role assignments, device access (including
            shared tablets), and all activity under their restaurant tenant.
          </li>
          <li>
            You are responsible for the legality of your menu, pricing, customer communications,
            and compliance with local laws applicable to your restaurant operations.
          </li>
          <li>
            You must not misuse the Service, attempt to access other tenants&apos; data, reverse
            engineer the platform, or interfere with its security or availability.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Trials and subscriptions">
        <p>
          Hilaac may offer a free trial. After a trial ends, continued use of paid features
          requires an active subscription. Subscriptions are billed on a{" "}
          <span className="font-medium text-[#0F172A]">monthly</span> basis according to the
          plan you select, unless otherwise stated at purchase. Fees are generally
          non-refundable except where required by law or expressly agreed in writing. We may
          change pricing with advance notice; continued use after the effective date constitutes
          acceptance of the new pricing.
        </p>
      </LegalSection>

      <LegalSection title="5. Payments and third-party services">
        <p>
          Where you enable mobile-money or other payment integrations, you authorize Hilaac to
          process transactions according to your configuration. You remain responsible for
          merchant accounts, settlement with payment providers, taxes, and customer refunds.
          Optional services such as WhatsApp or SMS are subject to those providers&apos; terms
          and fees.
        </p>
      </LegalSection>

      <LegalSection title="6. Customer data and privacy">
        <p>
          You retain ownership of your restaurant content and customer data you submit to
          Hilaac. You grant us a limited license to host and process that data solely to
          provide the Service. Our handling of personal data is described in our{" "}
          <a href="/privacy" className="font-medium text-[#D4A373] hover:underline">
            Privacy Policy
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="7. Acceptable use">
        <p>
          You agree not to use Hilaac for unlawful, fraudulent, or harmful purposes; to send
          spam or abusive messaging; to upload malware; or to violate the rights of others.
          We may suspend or terminate accounts that violate these Terms or create risk to the
          platform or other customers.
        </p>
      </LegalSection>

      <LegalSection title="8. Intellectual property">
        <p>
          Hilaac, including its software, branding, and documentation, is owned by Hilaac Smart
          Solution or its licensors. These Terms do not transfer ownership of our intellectual
          property to you. Feedback you provide may be used to improve the Service without
          obligation to you.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitation of liability">
        <p>
          To the maximum extent permitted by law, Hilaac is provided &quot;as is&quot; and
          &quot;as available,&quot; without warranties of uninterrupted or error-free
          operation. We are not liable for indirect, incidental, special, consequential, or
          punitive damages, or for lost profits, lost revenue, lost data, or business
          interruption, arising from your use of the Service. Our aggregate liability for
          claims relating to the Service will not exceed the fees you paid to Hilaac for the
          Service in the three (3) months preceding the claim. Some jurisdictions do not allow
          certain limitations; in those cases, our liability is limited to the fullest extent
          permitted by law.
        </p>
      </LegalSection>

      <LegalSection title="10. Indemnification">
        <p>
          You agree to indemnify and hold harmless Hilaac and its operators from claims arising
          out of your restaurant operations, staff actions, customer disputes, menu or pricing
          content, or misuse of the Service, except to the extent caused by our willful
          misconduct.
        </p>
      </LegalSection>

      <LegalSection title="11. Termination">
        <p>
          You may stop using Hilaac at any time. We may suspend or terminate access for breach
          of these Terms, non-payment, or risk to the Service. Upon termination, your right to
          use the Service ends; sections that by nature should survive (including limitation of
          liability and indemnification) will survive.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes to these Terms">
        <p>
          We may update these Terms periodically. We will post the updated Terms on this page
          and revise the &quot;Last updated&quot; date. Material changes may be communicated
          by email or in-product notice when appropriate. Continued use after the effective
          date constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact">
        <p>
          Questions about these Terms:{" "}
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
