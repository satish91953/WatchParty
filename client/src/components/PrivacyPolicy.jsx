import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const PrivacyPolicy = ({ onClose }) => {
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
            Privacy Policy
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
              1. Introduction
            </h2>
            <p>
              StreamTogether ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: 'var(--text-primary)' }}>
              2. Information We Collect
            </h2>
            
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginTop: '15px', marginBottom: '10px', color: 'var(--text-primary)' }}>
              2.1 Information You Provide
            </h3>
            <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
              <li><strong>Username:</strong> Display name you choose when joining rooms</li>
              <li><strong>Room Data:</strong> Room names, room IDs, and room settings</li>
              <li><strong>Chat Messages:</strong> Messages you send in room chat (if enabled)</li>
              <li><strong>Video URLs:</strong> YouTube or direct video URLs you share</li>
            </ul>

            <h3 style={{ fontSize: '16px', fontWeight: '600', marginTop: '15px', marginBottom: '10px', color: 'var(--text-primary)' }}>
              2.2 Automatically Collected Information
            </h3>
            <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
              <li><strong>Connection Data:</strong> Socket connection IDs for real-time communication</li>
              <li><strong>Usage Data:</strong> Room participation, timestamps, and activity</li>
              <li><strong>Technical Data:</strong> Browser type, device information (minimal)</li>
            </ul>

            <h3 style={{ fontSize: '16px', fontWeight: '600', marginTop: '15px', marginBottom: '10px', color: 'var(--text-primary)' }}>
              2.3 Local Storage
            </h3>
            <p>
              We store the following information locally in your browser:
            </p>
            <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
              <li>Username preference</li>
              <li>Theme preference (dark/light mode)</li>
              <li>Notification settings</li>
              <li>Temporary room data (for reconnection)</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: 'var(--text-primary)' }}>
              3. How We Use Your Information
            </h2>
            <p>We use the information we collect to:</p>
            <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
              <li>Provide and maintain the Service</li>
              <li>Enable real-time synchronization of video playback</li>
              <li>Facilitate voice chat and communication between users</li>
              <li>Manage room access and permissions</li>
              <li>Improve user experience and service functionality</li>
              <li>Ensure service security and prevent abuse</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: 'var(--text-primary)' }}>
              4. Data Storage and Retention
            </h2>
            <p>
              <strong>Server Storage:</strong> Room data, user information, and chat messages are stored in our database (MongoDB) while rooms are active. Inactive rooms may be automatically deleted after a period of inactivity.
            </p>
            <p style={{ marginTop: '15px' }}>
              <strong>Local Storage:</strong> Data stored in your browser's localStorage remains on your device until you clear your browser data or we update the storage format.
            </p>
            <p style={{ marginTop: '15px' }}>
              <strong>Retention:</strong> We retain data only as long as necessary to provide the Service. You can request deletion of your data at any time.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: 'var(--text-primary)' }}>
              5. Data Sharing and Disclosure
            </h2>
            <p>We do not sell, trade, or rent your personal information to third parties. We may share information only in the following circumstances:</p>
            <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
              <li><strong>Within Rooms:</strong> Your username and activity are visible to other users in the same room</li>
              <li><strong>Legal Requirements:</strong> If required by law or to protect our rights</li>
              <li><strong>Service Providers:</strong> With trusted third-party services that help us operate (e.g., hosting providers)</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: 'var(--text-primary)' }}>
              6. Third-Party Services
            </h2>
            <p>
              <strong>YouTube:</strong> When you watch YouTube videos, you are subject to YouTube's Privacy Policy. We embed YouTube videos using their official API, but we do not control YouTube's data collection practices.
            </p>
            <p style={{ marginTop: '15px' }}>
              <strong>WebRTC:</strong> Voice chat uses peer-to-peer WebRTC connections. Audio data is transmitted directly between users and is not stored on our servers.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: 'var(--text-primary)' }}>
              7. Your Rights (GDPR/CCPA)
            </h2>
            <p>Depending on your location, you may have the following rights:</p>
            <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data</li>
              <li><strong>Correction:</strong> Request correction of inaccurate data</li>
              <li><strong>Portability:</strong> Request your data in a portable format</li>
              <li><strong>Opt-out:</strong> Opt-out of certain data processing activities</li>
            </ul>
            <p style={{ marginTop: '15px' }}>
              To exercise these rights, please contact us through the appropriate channels.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: 'var(--text-primary)' }}>
              8. Security
            </h2>
            <p>
              We implement appropriate technical and organizational measures to protect your information. However, no method of transmission over the Internet is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: 'var(--text-primary)' }}>
              9. Children's Privacy
            </h2>
            <p>
              Our Service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: 'var(--text-primary)' }}>
              10. Changes to This Privacy Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: 'var(--text-primary)' }}>
              11. Contact Us
            </h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us through the appropriate channels.
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
              <strong>Note:</strong> This Privacy Policy is provided for informational purposes. For specific privacy concerns, please consult with a qualified privacy attorney.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

