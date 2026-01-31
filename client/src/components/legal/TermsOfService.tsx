export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto p-8 bg-white">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-8">
        Last updated: {new Date().toLocaleDateString('en-US')}
      </p>

      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
          <p className="text-gray-700 leading-relaxed">
            Welcome to <strong>InterDev Platform</strong> ("Platform", "We", "Our"). 
            By accessing and using this platform, you agree to comply with these Terms of Service ("Terms"). 
            Please read carefully before using.
          </p>
          <p className="text-gray-700 leading-relaxed mt-2">
            If you do not agree with any part of these terms, please do not use our service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">2. Eligible Users</h2>
          <p className="text-gray-700 leading-relaxed">
            InterDev Platform provides connection services between:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 mt-2 space-y-1">
            <li><strong>Clients</strong>: Individuals or organizations seeking to hire freelancers/brokers</li>
            <li><strong>Freelancers</strong>: Independent professionals providing specialized services</li>
            <li><strong>Brokers</strong>: Intermediaries connecting clients with suitable freelancers</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mt-2">
            You must be at least 18 years old and have full legal capacity under Vietnamese law to use the service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">3. Account & Security</h2>
          <div className="space-y-2 text-gray-700">
            <p className="font-semibold">3.1. Account Registration</p>
            <ul className="list-disc list-inside ml-4">
              <li>You commit to providing accurate, complete, and up-to-date information</li>
              <li>Registration email must be valid and regularly used (temporary emails not accepted)</li>
              <li>Password must be at least 8 characters with uppercase, lowercase, numbers, and special characters</li>
              <li>You are responsible for securing your login credentials</li>
            </ul>

            <p className="font-semibold mt-3">3.2. Identity Verification (KYC)</p>
            <p className="ml-4">
              To enhance trust and protect the community, we require identity verification through:
            </p>
            <ul className="list-disc list-inside ml-8">
              <li>National ID/Citizen ID</li>
              <li>Selfie photo for face verification</li>
              <li>Contact information (phone number, email)</li>
            </ul>
            <p className="ml-4 mt-2 text-sm italic text-gray-600">
              Note: All KYC information is encrypted and securely stored. Only authorized admin/staff can view 
              (with security watermark to prevent information leakage).
            </p>

            <p className="font-semibold mt-3">3.3. Security Responsibility</p>
            <ul className="list-disc list-inside ml-4">
              <li>Do not share your account with others</li>
              <li>Notify us immediately if you detect unusual activity</li>
              <li>Log out after each session, especially on shared devices</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">4. User Rights & Obligations</h2>
          <div className="space-y-2 text-gray-700">
            <p className="font-semibold">4.1. You ARE ALLOWED to:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Post job listings/search for work matching your expertise</li>
              <li>Contact and communicate with other members on the platform</li>
              <li>Rate and provide feedback on service quality after project completion</li>
              <li>Request support from management team when encountering issues</li>
            </ul>

            <p className="font-semibold mt-3">4.2. You ARE NOT ALLOWED to:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Provide false information or impersonate identity</li>
              <li>Spam, advertise unrelated content, or violate laws</li>
              <li>Use the platform for illegal purposes (money laundering, fraud, etc.)</li>
              <li>Infringe on others' intellectual property rights</li>
              <li>Attack, intrude systems, or exploit security vulnerabilities</li>
              <li>Screenshot or copy others' KYC information (serious violation)</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">5. Payment & Service Fees</h2>
          <p className="text-gray-700 leading-relaxed">
            InterDev charges service fees on each successful transaction. Details:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 mt-2 space-y-1">
            <li>Platform fee: 5-10% of project value (depending on contract type)</li>
            <li>Brokers earn commission from successfully connected projects</li>
            <li>Payments processed through licensed third-party payment gateways</li>
          </ul>
          <p className="text-gray-700 mt-2 italic text-sm">
            Detailed fee schedule and refund policy will be published separately and updated periodically.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">6. Intellectual Property</h2>
          <p className="text-gray-700 leading-relaxed">
            All content on InterDev Platform (logo, interface, source code, design) is owned by us or 
            licensed partners. Unauthorized copying, distribution, or use is strictly prohibited.
          </p>
          <p className="text-gray-700 mt-2">
            Users retain ownership of content they create (profile, portfolio, reviews), but grant 
            InterDev a non-exclusive license to operate the platform.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">7. Limitation of Liability</h2>
          <p className="text-gray-700 leading-relaxed">
            InterDev is a connection platform and does not directly provide freelance services. We are not responsible for:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 mt-2 space-y-1">
            <li>Work quality between freelancer and client</li>
            <li>Legal disputes arising from private contracts</li>
            <li>Indirect damages (loss of income, reputation) due to technical issues</li>
          </ul>
          <p className="text-gray-700 mt-2">
            However, we commit to mediation support through our <strong>Dispute Management System</strong> 
            to protect user rights.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">8. Account Termination</h2>
          <p className="text-gray-700 leading-relaxed">
            We reserve the right to suspend or delete accounts if:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 mt-2 space-y-1">
            <li>Violating Terms of Service or Privacy Policy</li>
            <li>Engaging in fraud, scam, or spam activities</li>
            <li>Accumulating too many warnings from Trust Score system</li>
            <li>Losing serious disputes (≥ 3 times)</li>
          </ul>
          <p className="text-gray-700 mt-2">
            You may delete your account anytime, but deleted data cannot be recovered.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">9. Terms Modification</h2>
          <p className="text-gray-700 leading-relaxed">
            We reserve the right to update these Terms at any time. Important changes will be notified 
            via email or platform notification at least 7 days before taking effect.
          </p>
          <p className="text-gray-700 mt-2">
            Your continued use of the service after changes take effect constitutes acceptance of the new terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">10. Governing Law & Dispute Resolution</h2>
          <p className="text-gray-700 leading-relaxed">
            These Terms are governed by the laws of the Socialist Republic of Vietnam.
          </p>
          <p className="text-gray-700 mt-2">
            All disputes shall be resolved through negotiation. If unsuccessful, they will be submitted to 
            the competent People's Court in Ho Chi Minh City.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">11. Contact</h2>
          <p className="text-gray-700 leading-relaxed">
            If you have any questions about these Terms of Service, please contact:
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-3">
            <p className="text-gray-700"><strong>Email:</strong> legal@interdev.vn</p>
            <p className="text-gray-700"><strong>Hotline:</strong> 1900-xxxx-xx</p>
            <p className="text-gray-700"><strong>Address:</strong> [Office address in Vietnam]</p>
          </div>
        </section>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} InterDev Platform. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
