import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const TermsOfService = ({ onClose }) => {
  const { isDark } = useTheme();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      overflowY: 'auto'
    }} onClick={onClose}>
      <div style={{
        background: isDark ? 'var(--bg-primary)' : '#ffffff',
        color: 'var(--text-primary)',
        borderRadius: '16px',
        padding: '40px',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        border: '1px solid var(--border-color)'
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px',
          borderBottom: '2px solid var(--border-color)',
          paddingBottom: '20px'
        }}>
          <h1 style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: '700',
            color: 'var(--text-primary)'
          }}>
            Terms of Service
          </h1>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '8px 16px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              fontSize: '16px',
              fontWeight: '600'
            }}
          >
            ✕ Close
          </button>
        </div>

        <div style={{
          fontSize: '14px',
          lineHeight: '1.8',
          color: 'var(--text-secondary)'
        }}>
          <p style={{ marginBottom: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
            Last Updated: January 2025
          </p>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: 'var(--text-primary)' }}>
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing and using StreamTogether ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: 'var(--text-primary)' }}>
              2. YouTube Content Compliance
            </h2>
            <p>
              StreamTogether allows users to watch YouTube videos together through YouTube's official embedding API. By using YouTube videos on this platform, you agree to:
            </p>
            <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
              <li>Comply with YouTube's Terms of Service</li>
              <li>Respect YouTube's content policies and copyright</li>
              <li>Not use the service to watch restricted or private YouTube videos</li>
              <li>Understand that YouTube videos are subject to YouTube's availability and policies</li>
            </ul>
            <p style={{ marginTop: '15px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', borderLeft: '4px solid var(--accent-color)' }}>
              <strong>Disclaimer:</strong> StreamTogether is not affiliated with, endorsed by, or sponsored by YouTube. We are not responsible for the availability, content, or removal of YouTube videos. YouTube content is subject to YouTube's Terms of Service and policies.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: 'var(--text-primary)' }}>
              3. User Responsibilities
            </h2>
            <p>You are responsible for:</p>
            <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
              <li>Maintaining the confidentiality of your account and room passwords</li>
              <li>All activities that occur under your account</li>
              <li>Ensuring you have the right to share any content you provide</li>
              <li>Using the service in a lawful manner</li>
              <li>Not harassing, abusing, or harming other users</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: 'var(--text-primary)' }}>
              4. Prohibited Content
            </h2>
            <p>You agree not to use the Service to:</p>
            <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
              <li>Share copyrighted material without permission</li>
              <li>Share illegal, harmful, or offensive content</li>
              <li>Harass, threaten, or abuse other users</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Interfere with or disrupt the Service</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: 'var(--text-primary)' }}>
              5. Service Availability
            </h2>
            <p>
              StreamTogether is provided "as-is" and "as-available" without warranties of any kind. We do not guarantee that the Service will be uninterrupted, secure, or error-free. We reserve the right to modify, suspend, or discontinue the Service at any time without notice.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: 'var(--text-primary)' }}>
              6. Limitation of Liability
            </h2>
            <p>
              To the fullest extent permitted by law, StreamTogether shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from your use of the Service.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: 'var(--text-primary)' }}>
              7. Intellectual Property
            </h2>
            <p>
              The Service and its original content, features, and functionality are owned by StreamTogether and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: 'var(--text-primary)' }}>
              8. Termination
            </h2>
            <p>
              We reserve the right to terminate or suspend your access to the Service immediately, without prior notice or liability, for any reason, including if you breach the Terms of Service.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: 'var(--text-primary)' }}>
              9. Changes to Terms
            </h2>
            <p>
              We reserve the right to modify these terms at any time. We will notify users of any material changes by updating the "Last Updated" date. Your continued use of the Service after any changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: 'var(--text-primary)' }}>
              10. Contact Information
            </h2>
            <p>
              If you have any questions about these Terms of Service, please contact us through the appropriate channels.
            </p>
          </section>

          <div style={{
            marginTop: '40px',
            padding: '20px',
            background: 'var(--bg-tertiary)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)'
          }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              <strong>Legal Disclaimer:</strong> This Terms of Service document is provided for informational purposes only and does not constitute legal advice. For specific legal concerns, please consult with a qualified attorney.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;

