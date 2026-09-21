import { Link } from 'react-router-dom'
import BackToHome from '@/components/common/BackToHome'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen pt-20 pb-24">
      <div className="max-w-4xl mx-auto px-4">
        <BackToHome />
        
        <div className="py-6 border-b border-border mb-8">
          <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p className="text-muted-foreground">
              ZedVevo ("we," "us," "our," or "Company") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
            <p className="text-muted-foreground mb-2">We may collect information about you in a variety of ways:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li><strong>Personal Information:</strong> Name, email address, phone number, and other information you provide when registering or using our services</li>
              <li><strong>Payment Information:</strong> Payment details when making purchases through Lipila</li>
              <li><strong>Usage Data:</strong> Information about how you use our platform, including listen history, search queries, and interactions</li>
              <li><strong>Device Information:</strong> Device type, operating system, browser type, and IP address</li>
              <li><strong>Cookies:</strong> Information stored in cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-2">We use the information we collect for:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li>Providing and improving our services</li>
              <li>Processing transactions and sending related information</li>
              <li>Sending promotional communications (with your consent)</li>
              <li>Responding to your inquiries and customer support</li>
              <li>Analyzing usage patterns and trends</li>
              <li>Personalizing your experience</li>
              <li>Complying with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Information Sharing</h2>
            <p className="text-muted-foreground">
              We do not sell, trade, or rent your personal information to third parties. We may share information with:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
              <li>Service providers who assist us in operating our website and conducting business</li>
              <li>Legal authorities when required by law</li>
              <li>Other parties with your explicit consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Security</h2>
            <p className="text-muted-foreground">
              We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Cookies and Tracking</h2>
            <p className="text-muted-foreground">
              ZedVevo uses cookies and similar tracking technologies to enhance your experience. You can control cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
            <p className="text-muted-foreground">
              Depending on your jurisdiction, you may have rights to access, correct, or delete your personal information. Please contact us to exercise these rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Children's Privacy</h2>
            <p className="text-muted-foreground">
              ZedVevo does not knowingly collect personal information from children under 13 years of age. If we become aware of such collection, we will take appropriate steps to delete the information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Third-Party Links</h2>
            <p className="text-muted-foreground">
              Our website may contain links to third-party websites. We are not responsible for their privacy practices. Please review their privacy policies before providing personal information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new Privacy Policy on this page with an updated "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have questions about this Privacy Policy or our privacy practices, please <Link to="/" className="text-accent hover:underline">contact us</Link>.
            </p>
          </section>

          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground">
              This Privacy Policy was last updated on {new Date().toLocaleDateString()}.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
