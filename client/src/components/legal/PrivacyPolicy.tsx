export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto p-8 bg-white">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">
        Last updated: {new Date().toLocaleDateString('en-US')}
      </p>

      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">1. Privacy Commitment</h2>
          <p className="text-gray-700 leading-relaxed">
            <strong>InterDev Platform</strong> is committed to protecting user privacy and personal data. 
            This policy describes how we collect, use, store, and protect your information.
          </p>
          <p className="text-gray-700 leading-relaxed mt-2">
            We comply with personal data protection regulations under Vietnam's Decree 13/2023/ND-CP 
            and international security standards.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
          <div className="space-y-3 text-gray-700">
            <div>
              <p className="font-semibold">2.1. Basic registration information:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Full name</li>
                <li>Email address (must be valid and regularly used)</li>
                <li>Phone number (Vietnam format)</li>
                <li>Password (encrypted with bcrypt using 12 salt rounds)</li>
                <li>Role (Client, Freelancer, Broker)</li>
              </ul>
            </div>

            <div>
              <p className="font-semibold">2.2. Identity verification (KYC) information:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>National ID/Citizen ID photos (front and back)</li>
                <li>Selfie photo for face verification</li>
                <li>Information extracted from ID: ID number, name, date of birth, address, issue date</li>
              </ul>
              <p className="ml-4 mt-2 text-sm italic text-blue-600">
                ⚠️ KYC information is encrypted with AES-256-GCM before storage. Only authorized admin/staff can view, 
                and each view session will have a security watermark (showing viewer, time, IP) to prevent data leakage.
              </p>
            </div>

            <div>
              <p className="font-semibold">2.3. Technical and activity data:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Registration and login IP addresses</li>
                <li>User-Agent (browser, device information)</li>
                <li>Login history and sessions</li>
                <li>Audit logs (system logs: account creation, login, KYC viewing, etc.)</li>
                <li>Cookies and local storage (to maintain login session)</li>
              </ul>
            </div>

            <div>
              <p className="font-semibold">2.4. Professional information (Freelancer/Broker):</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Selected domains and skills</li>
                <li>Portfolio, certificates, work experience</li>
                <li>Client ratings and reviews</li>
              </ul>
            </div>

            <div>
              <p className="font-semibold">2.5. Transaction data:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Project history (completed, in progress, cancelled)</li>
                <li>Payment information (card numbers not stored, only transaction status)</li>
                <li>Dispute history (if any)</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">3. Purpose of Data Use</h2>
          <p className="text-gray-700 leading-relaxed">We use your personal data for the following purposes:</p>
          <ul className="list-disc list-inside text-gray-700 ml-4 mt-2 space-y-1">
            <li><strong>Service provision:</strong> Account management, freelancer-client connection, transaction processing</li>
            <li><strong>Identity verification:</strong> Prevent fraud, impersonation, increase trust</li>
            <li><strong>Security:</strong> Detect unusual activity, protect against attacks</li>
            <li><strong>Service improvement:</strong> Analyze user behavior to optimize experience</li>
            <li><strong>Customer support:</strong> Resolve complaints, disputes, support requests</li>
            <li><strong>Legal compliance:</strong> Store data as required by government agencies</li>
            <li><strong>Marketing (with consent only):</strong> Send emails about new features, promotions</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">4. Third-Party Data Sharing</h2>
          <p className="text-gray-700 leading-relaxed">
            We <strong className="underline">DO NOT SELL</strong> your personal data. However, 
            we may share with the following parties:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 mt-2 space-y-1">
            <li><strong>Technical partners:</strong> Supabase (storage), FPT.AI (ID verification), Nodemailer (email sending)</li>
            <li><strong>Payment gateways:</strong> Licensed payment partners (VNPay, MoMo, etc.)</li>
            <li><strong>Government agencies:</strong> When legally requested by competent authorities</li>
            <li><strong>Legal disputes:</strong> Provide evidence when there are complaints, lawsuits</li>
          </ul>
          <p className="text-gray-700 mt-2 italic text-sm">
            All partners sign confidentiality agreements (NDA) and comply with international security standards.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">5. Security Measures</h2>
          <p className="text-gray-700 leading-relaxed">
            We apply advanced security measures to protect your data:
          </p>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mt-3">
            <ul className="space-y-2 text-gray-700">
              <li>
                <strong>Password encryption:</strong> bcrypt with 12 salt rounds 
                (cannot be reverse-engineered, only hash comparison)
              </li>
              <li>
                <strong>KYC encryption:</strong> AES-256-GCM for all ID photos and sensitive information
              </li>
              <li>
                <strong>Security watermark:</strong> Each admin/staff KYC view logged with IP, timestamp, viewer email
              </li>
              <li>
                <strong>HTTPS:</strong> All communications encrypted with SSL/TLS
              </li>
              <li>
                <strong>JWT Token:</strong> Short-lived access token (15 min), refresh token in httpOnly cookie
              </li>
              <li>
                <strong>Rate Limiting:</strong> Limit registration/login attempts to prevent brute-force
              </li>
              <li>
                <strong>Google reCAPTCHA:</strong> Block bots and automated spam
              </li>
              <li>
                <strong>Audit Logs:</strong> Record all important actions (login, KYC view, disputes) with risk level
              </li>
              <li>
                <strong>Database Security:</strong> TypeORM parameterized queries (prevent SQL injection), periodic backups
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">6. Data Retention Period</h2>
          <p className="text-gray-700 leading-relaxed">
            We store your data for the following periods:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 mt-2 space-y-1">
            <li><strong>Active accounts:</strong> Stored indefinitely until you request deletion</li>
            <li><strong>Audit logs:</strong> Minimum 2 years storage as required by law</li>
            <li><strong>KYC data:</strong> 5 years after account deletion (per anti-money laundering regulations)</li>
            <li><strong>Session logs:</strong> Deleted after 90 days of inactivity</li>
            <li><strong>Email verification tokens:</strong> Expire after 24 hours</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">7. User Rights</h2>
          <p className="text-gray-700 leading-relaxed">
            Under Decree 13/2023/ND-CP, you have the following rights regarding personal data:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 mt-2 space-y-1">
            <li><strong>Right to access:</strong> View personal data we are storing</li>
            <li><strong>Right to edit:</strong> Update inaccurate information</li>
            <li><strong>Right to delete:</strong> Request account and personal data deletion (with some legal exceptions)</li>
            <li><strong>Right to refuse:</strong> Disagree with data processing for marketing purposes</li>
            <li><strong>Right to withdraw consent:</strong> Revoke previously granted consent (if any)</li>
            <li><strong>Right to complain:</strong> File complaints to Data Protection Authority if suspected violations</li>
          </ul>
          <p className="text-gray-700 mt-3">
            To exercise these rights, please contact: <strong>privacy@interdev.vn</strong>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">8. Cookies & Tracking Technologies</h2>
          <p className="text-gray-700 leading-relaxed">
            We use the following types of cookies:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 mt-2 space-y-1">
            <li><strong>Essential cookies:</strong> Necessary for platform operation (refresh token, session ID)</li>
            <li><strong>Performance cookies:</strong> Analyze traffic, optimize performance</li>
            <li><strong>Functional cookies:</strong> Store user preferences (language, interface)</li>
          </ul>
          <p className="text-gray-700 mt-2">
            You can refuse non-essential cookies through browser settings, but this may affect user experience.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">9. Children's Data Protection</h2>
          <p className="text-gray-700 leading-relaxed">
            Our service is only for users aged 18 and above. We do not intentionally collect data 
            from children under 18. If such cases are discovered, we will delete the data immediately.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">10. Policy Updates</h2>
          <p className="text-gray-700 leading-relaxed">
            This Privacy Policy may be updated periodically to reflect changes in laws or services. 
            We will notify via email or platform notification at least 7 days before changes take effect.
          </p>
          <p className="text-gray-700 mt-2">
            The last update date is displayed at the top of this document.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">11. Data Protection Officer (DPO)</h2>
          <p className="text-gray-700 leading-relaxed">
            If you have questions or complaints about how we process personal data, please contact:
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-3">
            <p className="text-gray-700"><strong>Email:</strong> privacy@interdev.vn</p>
            <p className="text-gray-700"><strong>Hotline:</strong> 1900-xxxx-xx</p>
            <p className="text-gray-700"><strong>Address:</strong> [Office address in Vietnam]</p>
            <p className="text-gray-700 mt-2"><strong>DPO (Data Protection Officer):</strong> [Officer name]</p>
          </div>
        </section>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} InterDev Platform. We are committed to protecting your privacy.
          </p>
        </div>
      </div>
    </div>
  );
}
