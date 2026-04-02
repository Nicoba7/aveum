const S = {
  page: {
    background: "#060A12",
    minHeight: "100vh",
    color: "#F9FAFB",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    maxWidth: 480,
    margin: "0 auto",
    padding: "0 20px",
  } as React.CSSProperties,

  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 0 24px",
  } as React.CSSProperties,

  logo: {
    fontSize: 18,
    fontWeight: 800,
    color: "#F9FAFB",
    textDecoration: "none",
    letterSpacing: -0.5,
  } as React.CSSProperties,

  back: {
    fontSize: 13,
    color: "#9CA3AF",
    textDecoration: "none",
  } as React.CSSProperties,

  heading: {
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: -0.8,
    color: "#F9FAFB",
    marginBottom: 8,
    marginTop: 8,
    lineHeight: 1.2,
  } as React.CSSProperties,

  lastUpdated: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 26,
  } as React.CSSProperties,

  section: {
    marginBottom: 36,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#4B5563",
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    marginBottom: 10,
  } as React.CSSProperties,

  body: {
    fontSize: 14,
    color: "#D1D5DB",
    lineHeight: 1.65,
    margin: 0,
  } as React.CSSProperties,

  footer: {
    borderTop: "1px solid #111827",
    padding: "20px 0 32px",
    fontSize: 12,
    color: "#374151",
    textAlign: "center" as const,
    marginTop: 12,
  } as React.CSSProperties,
};

export default function Terms() {
  return (
    <div style={S.page}>
      {/* Nav */}
      <nav style={S.nav}>
        <a href="/" style={S.logo}>Aveum</a>
        <a href="/" style={S.back}>← Back</a>
      </nav>

      <h1 style={S.heading}>Terms of Service</h1>
      <div style={S.lastUpdated}>Last updated: 2 April 2026</div>

      <section style={S.section}>
        <div style={S.sectionTitle}>1. Acceptance of Terms</div>
        <p style={S.body}>
          By accessing or using Aveum at getaveum.com you agree to be bound by these Terms. If you do not agree, do not use the Service.
        </p>
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>2. Description of Service</div>
        <p style={S.body}>
          Aveum provides an automated home energy optimisation service that connects to your energy devices and tariff accounts to schedule energy usage during lowest-cost periods. The Service includes a web application, daily email reports, and automated device scheduling via third-party APIs.
        </p>
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>3. Eligibility</div>
        <p style={S.body}>
          You must be at least 18 years of age to use the Service and have legal authority to provide the device credentials and account information you submit.
        </p>
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>4. Device Access and Authorisation</div>
        <p style={S.body}>
          By connecting your energy devices you expressly authorise Aveum to access and control those devices on your behalf solely for the purpose of energy optimisation. You confirm you are the owner or authorised user of all connected devices. Aveum will only access your devices during scheduled optimisation windows.
        </p>
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>5. No Guarantee of Savings</div>
        <p style={S.body}>
          Energy savings figures are estimates based on live and historical tariff data. Actual results may vary. We make no guarantee of specific financial savings or outcomes.
        </p>
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>6. Limitation of Liability</div>
        <p style={S.body}>
          To the maximum extent permitted by applicable law, Aveum shall not be liable for any indirect, incidental, special, consequential or punitive damages including damage to your energy devices, increased energy costs resulting from suboptimal scheduling, or loss of data. Our total liability to you for any claim shall not exceed the amount you have paid us in the preceding 12 months or £100, whichever is greater.
        </p>
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>7. Disclaimer of Warranties</div>
        <p style={S.body}>
          The Service is provided "as is" and "as available" without warranties of any kind, either express or implied.
        </p>
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>8. Third-Party Services</div>
        <p style={S.body}>
          The Service integrates with third-party APIs including Octopus Energy, GivEnergy, Solax, Ohme, Tesla, myenergi, EcoFlow, SolarEdge, and Huawei FusionSolar. We are not responsible for the availability, accuracy, or reliability of these third-party services.
        </p>
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>9. Acceptable Use</div>
        <p style={S.body}>
          You agree not to use the Service to violate any applicable laws, interfere with or disrupt the Service, or attempt to gain unauthorised access to any part of the Service.
        </p>
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>10. Intellectual Property</div>
        <p style={S.body}>
          The Service and its content are owned by Aveum and protected by applicable intellectual property laws. You may not copy, modify, distribute, or sell any part without prior written consent.
        </p>
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>11. Termination</div>
        <p style={S.body}>
          We may suspend or terminate your access at any time for breach of these Terms. You may terminate by emailing hello@getaveum.com. Your data will be deleted within 30 days of termination.
        </p>
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>12. Changes to Terms</div>
        <p style={S.body}>
          We may update these Terms at any time. We will notify registered users of material changes by email. Continued use constitutes acceptance.
        </p>
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>13. Governing Law</div>
        <p style={S.body}>
          These Terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.
        </p>
      </section>

      <section style={S.section}>
        <div style={S.sectionTitle}>14. Contact</div>
        <p style={S.body}>hello@getaveum.com · getaveum.com</p>
      </section>

      {/* Footer */}
      <footer style={S.footer}>
        getaveum.com · © 2026 Aveum · Built in London
      </footer>
    </div>
  );
}
