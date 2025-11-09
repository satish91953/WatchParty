import React, { useState } from 'react';

function RoomControls({ onCreateRoom, onJoinRoom, disabled }) {
  const [joinRoomId, setJoinRoomId] = useState('');
  const [roomName, setRoomName] = useState('');

  const handleCreateRoom = (e) => {
    e.preventDefault();
    onCreateRoom(roomName.trim() || 'My Watch Party');
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (joinRoomId.trim()) {
      onJoinRoom(joinRoomId.trim());
    }
  };

  return (
    <div className="component-card" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ 
        textAlign: 'center', 
        marginBottom: '40px',
        fontSize: '32px',
        fontWeight: '800',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
      }}>
        🎬 Welcome to Watch Party Pro
      </h2>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '30px',
        marginBottom: '30px'
      }}>
        {/* Create Room Section */}
        <div style={{
          padding: '28px',
          background: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '2px solid #28a745',
          boxShadow: '0 8px 24px rgba(40, 167, 69, 0.2)',
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'hidden'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 12px 32px rgba(40, 167, 69, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(40, 167, 69, 0.2)';
        }}
        >
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '100px',
            height: '100px',
            background: 'radial-gradient(circle, rgba(40, 167, 69, 0.1) 0%, transparent 70%)',
            borderRadius: '50%'
          }}></div>
          <h3 style={{ 
            color: '#28a745', 
            marginBottom: '20px',
            fontSize: '20px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '24px' }}>🎯</span> Create New Room
          </h3>
          <form onSubmit={handleCreateRoom}>
            <input
              type="text"
              placeholder="Room name (optional)"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              disabled={disabled}
              style={{ 
                width: '100%', 
                marginBottom: '18px',
                padding: '14px 16px',
                fontSize: '15px'
              }}
            />
            <button 
              type="submit"
              disabled={disabled}
              className="btn-success"
              style={{ 
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: '700'
              }}
            >
              🚀 Create Room
            </button>
          </form>
          <p style={{ 
            fontSize: '13px', 
            color: 'var(--text-secondary)', 
            marginTop: '16px',
            textAlign: 'center',
            lineHeight: '1.5'
          }}>
            Start a new watch party and get a room code to share
          </p>
        </div>

        {/* Join Room Section */}
        <div style={{
          padding: '28px',
          background: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '2px solid #007bff',
          boxShadow: '0 8px 24px rgba(0, 123, 255, 0.2)',
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'hidden'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 123, 255, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 123, 255, 0.2)';
        }}
        >
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '100px',
            height: '100px',
            background: 'radial-gradient(circle, rgba(0, 123, 255, 0.1) 0%, transparent 70%)',
            borderRadius: '50%'
          }}></div>
          <h3 style={{ 
            color: '#007bff', 
            marginBottom: '20px',
            fontSize: '20px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '24px' }}>🔗</span> Join Existing Room
          </h3>
          <form onSubmit={handleJoinRoom}>
            <input
              type="text"
              placeholder="ENTER ROOM CODE..."
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
              disabled={disabled}
              style={{ 
                width: '100%', 
                marginBottom: '18px',
                padding: '14px 16px',
                fontSize: '15px',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                fontWeight: '600'
              }}
              maxLength={6}
            />
            <button 
              type="submit"
              disabled={disabled || !joinRoomId.trim()}
              className="btn-info"
              style={{ 
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: '700',
                opacity: (disabled || !joinRoomId.trim()) ? 0.6 : 1,
                cursor: (disabled || !joinRoomId.trim()) ? 'not-allowed' : 'pointer'
              }}
            >
              🎭 Join Room
            </button>
          </form>
          <p style={{ 
            fontSize: '13px', 
            color: 'var(--text-secondary)', 
            marginTop: '16px',
            textAlign: 'center',
            lineHeight: '1.5'
          }}>
            Enter the 6-character room code from your friend
          </p>
        </div>
      </div>

      <div style={{
        textAlign: 'center',
        padding: '28px',
        background: 'var(--bg-secondary)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <h4 style={{ 
          marginBottom: '20px',
          fontSize: '18px',
          fontWeight: '700',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '20px' }}>✨</span> Features Available
        </h4>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '20px',
          flexWrap: 'wrap',
          fontSize: '14px',
          color: 'var(--text-secondary)'
        }}>
          {[
            { icon: '🎬', text: 'Synced Video' },
            { icon: '🎤', text: 'Voice Chat' },
            { icon: '📹', text: 'Video Chat' },
            { icon: '🖥️', text: 'Screen Share' },
            { icon: '💬', text: 'Text Chat' },
            { icon: '🎭', text: 'Reactions' },
            { icon: '📝', text: 'Subtitles' }
          ].map((feature, idx) => (
            <span 
              key={idx}
              style={{
                padding: '8px 16px',
                background: 'var(--bg-tertiary)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.3s ease',
                cursor: 'default'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.background = 'var(--bg-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.background = 'var(--bg-tertiary)';
              }}
            >
              <span>{feature.icon}</span>
              <span style={{ fontWeight: '500' }}>{feature.text}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default RoomControls;
