import React, { useState, useEffect } from 'react';

function RoomControls({ onCreateRoom, onJoinRoom, disabled, pendingRoomFromUrl, onPendingRoomHandled }) {
  const [joinRoomId, setJoinRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);
  const [modalUsername, setModalUsername] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // 'create' or 'join'
  
  // Show name modal automatically if there's a pending room from URL
  useEffect(() => {
    if (pendingRoomFromUrl && !showNameModal) {
      setPendingAction('join');
      setJoinRoomId(pendingRoomFromUrl);
      // Pre-fill username if available, but still show modal
      const savedUsername = localStorage.getItem('watchParty_username') || '';
      if (savedUsername && !savedUsername.startsWith('Guest-')) {
        setModalUsername(savedUsername);
      }
      setShowNameModal(true);
    }
  }, [pendingRoomFromUrl, showNameModal]);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    // Always show name modal
    setPendingAction('create');
    setShowNameModal(true);
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!joinRoomId.trim()) {
      alert('Please enter a room code');
      return;
    }
    // Show name modal
    setPendingAction('join');
    setShowNameModal(true);
  };

  const handleNameSubmit = () => {
    const trimmedUsername = modalUsername.trim();
    if (!trimmedUsername || trimmedUsername.startsWith('Guest-')) {
      alert('Please enter your name (not "Guest-")');
      return;
    }
    
    // Save username to localStorage
    localStorage.setItem('watchParty_username', trimmedUsername);
    
    // Close modal
    setShowNameModal(false);
    setModalUsername('');
    
    // Execute pending action
    if (pendingAction === 'create') {
      onCreateRoom(roomName.trim() || 'My Watch Party', trimmedUsername);
    } else if (pendingAction === 'join') {
      onJoinRoom(joinRoomId.trim(), trimmedUsername);
      // Clear pending room from URL if it was from URL
      if (pendingRoomFromUrl) {
        onPendingRoomHandled();
      }
    }
    
    setPendingAction(null);
  };

  const handleNameCancel = () => {
    setShowNameModal(false);
    setModalUsername('');
    setPendingAction(null);
    // Clear pending room from URL if it was from URL
    if (pendingRoomFromUrl) {
      onPendingRoomHandled();
      setJoinRoomId('');
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
        gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : '1fr 1fr', 
        gap: window.innerWidth <= 768 ? '20px' : '30px',
        marginBottom: window.innerWidth <= 768 ? '20px' : '30px'
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
              className="btn-success touch-friendly"
              style={{ 
                width: '100%',
                padding: window.innerWidth <= 768 ? '16px' : '14px',
                fontSize: window.innerWidth <= 768 ? '16px' : '16px',
                fontWeight: '700',
                minHeight: '48px',
                touchAction: 'manipulation'
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
              className="btn-info touch-friendly"
              style={{ 
                width: '100%',
                padding: window.innerWidth <= 768 ? '16px' : '14px',
                fontSize: window.innerWidth <= 768 ? '16px' : '16px',
                fontWeight: '700',
                opacity: (disabled || !joinRoomId.trim()) ? 0.6 : 1,
                cursor: (disabled || !joinRoomId.trim()) ? 'not-allowed' : 'pointer',
                minHeight: '48px',
                touchAction: 'manipulation'
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

      {/* Name Input Modal */}
      {showNameModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(4px)'
        }}
        onClick={handleNameCancel}
        >
          <div style={{
            background: 'var(--bg-secondary)',
            padding: '32px',
            borderRadius: '20px',
            border: '2px solid var(--border-color)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            maxWidth: '400px',
            width: '90%',
            position: 'relative',
            zIndex: 10001
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              margin: '0 0 20px 0',
              fontSize: '24px',
              fontWeight: '700',
              color: 'var(--text-primary)',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '28px' }}>👤</span>
              Enter Your Name
            </h3>
            <p style={{
              margin: '0 0 20px 0',
              fontSize: '14px',
              color: 'var(--text-secondary)',
              textAlign: 'center'
            }}>
              {pendingAction === 'create' 
                ? 'Please enter your name to create a room' 
                : 'Please enter your name to join the room'}
            </p>
            <input
              type="text"
              placeholder="Your name *"
              value={modalUsername}
              onChange={(e) => setModalUsername(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleNameSubmit();
                }
              }}
              autoFocus
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: '16px',
                marginBottom: '20px',
                borderRadius: '8px',
                border: modalUsername.trim() && !modalUsername.trim().startsWith('Guest-')
                  ? '2px solid #28a745'
                  : '2px solid #dc3545',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <button
                onClick={handleNameCancel}
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: '15px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  border: '2px solid var(--border-color)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-secondary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleNameSubmit}
                disabled={!modalUsername.trim() || modalUsername.trim().startsWith('Guest-')}
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: '15px',
                  fontWeight: '700',
                  borderRadius: '8px',
                  border: 'none',
                  background: pendingAction === 'create' 
                    ? 'linear-gradient(135deg, #28a745, #20c997)'
                    : 'linear-gradient(135deg, #007bff, #138496)',
                  color: 'white',
                  cursor: (!modalUsername.trim() || modalUsername.trim().startsWith('Guest-')) 
                    ? 'not-allowed' 
                    : 'pointer',
                  opacity: (!modalUsername.trim() || modalUsername.trim().startsWith('Guest-')) 
                    ? 0.6 
                    : 1,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (modalUsername.trim() && !modalUsername.trim().startsWith('Guest-')) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {pendingAction === 'create' ? '🚀 Create' : '🎭 Join'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoomControls;
