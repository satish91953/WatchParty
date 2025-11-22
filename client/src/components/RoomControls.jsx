import React, { useState, useEffect } from 'react';

function RoomControls({ onCreateRoom, onJoinRoom, onCreatePrivateRoom, onJoinPrivateRoom, disabled, pendingRoomFromUrl, onPendingRoomHandled }) {
  const [joinRoomId, setJoinRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [privateRoomName, setPrivateRoomName] = useState('');
  const [privateRoomPassword, setPrivateRoomPassword] = useState('');
  const [joinPrivateRoomId, setJoinPrivateRoomId] = useState('');
  const [joinPrivateRoomPassword, setJoinPrivateRoomPassword] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);
  const [modalUsername, setModalUsername] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // 'create', 'join', 'createPrivate', 'joinPrivate'
  const [pendingPassword, setPendingPassword] = useState('');
  
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

  const handleCreatePrivateRoom = (e) => {
    e.preventDefault();
    if (!privateRoomPassword.trim()) {
      alert('Please enter a password for the private room');
      return;
    }
    // Always show name modal
    setPendingAction('createPrivate');
    setPendingPassword(privateRoomPassword.trim());
    setShowNameModal(true);
  };

  const handleJoinPrivateRoom = (e) => {
    e.preventDefault();
    if (!joinPrivateRoomId.trim()) {
      alert('Please enter a room code');
      return;
    }
    if (!joinPrivateRoomPassword.trim()) {
      alert('Please enter the room password');
      return;
    }
    // Show name modal
    setPendingAction('joinPrivate');
    setPendingPassword(joinPrivateRoomPassword.trim());
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
    } else if (pendingAction === 'createPrivate') {
      onCreatePrivateRoom(privateRoomName.trim() || 'My Private Watch Party', trimmedUsername, pendingPassword);
      setPrivateRoomPassword('');
      setPrivateRoomName('');
    } else if (pendingAction === 'joinPrivate') {
      onJoinPrivateRoom(joinPrivateRoomId.trim(), trimmedUsername, pendingPassword);
      setJoinPrivateRoomPassword('');
      setJoinPrivateRoomId('');
    }
    
    setPendingAction(null);
    setPendingPassword('');
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
    <div className="component-card" style={{ 
      maxWidth: '100%',
      margin: '0',
      width: '100%',
      padding: window.innerWidth <= 768 ? '20px' : '32px',
      borderRadius: '12px',
      boxSizing: 'border-box'
    }}>
      <h2 style={{ 
        textAlign: 'center', 
        marginBottom: '30px',
        marginTop: '10px',
        marginLeft: '0',
        marginRight: '0',
        fontSize: window.innerWidth <= 768 ? '24px' : '28px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        lineHeight: '1.2',
        opacity: 0.9
      }}>
        Welcome to StreamTogether
      </h2>
      
      {/* Header Row - Aligned with card groups */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'repeat(4, 1fr)', 
        gap: window.innerWidth <= 768 ? '20px' : '20px',
        marginBottom: '20px'
      }}>
        <h3 style={{
          color: 'var(--text-primary)',
          fontSize: '22px',
          fontWeight: '700',
          textAlign: 'center',
          opacity: 0.9,
          margin: 0,
          gridColumn: window.innerWidth <= 768 ? '1' : '1 / 3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          🌐 Public Room
        </h3>
        <h3 style={{
          color: 'var(--text-primary)',
          fontSize: '22px',
          fontWeight: '700',
          textAlign: 'center',
          opacity: 0.9,
          margin: 0,
          gridColumn: window.innerWidth <= 768 ? '1' : '3 / 5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          🔒 Private Room
        </h3>
      </div>

      {/* Cards Row */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'repeat(4, 1fr)', 
        gap: window.innerWidth <= 768 ? '20px' : '20px',
        marginBottom: window.innerWidth <= 768 ? '20px' : '30px',
        alignItems: 'stretch'
      }}>
        {/* Create Public Room Section */}
        <div style={{
          padding: '28px',
          background: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '1.5px solid rgba(34, 197, 94, 0.3)',
          boxShadow: '0 4px 16px rgba(34, 197, 94, 0.08)',
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(34, 197, 94, 0.12)';
          e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(34, 197, 94, 0.08)';
          e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)';
        }}
        >
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '100px',
            height: '100px',
            background: 'radial-gradient(circle, rgba(34, 197, 94, 0.05) 0%, transparent 70%)',
            borderRadius: '50%'
          }}></div>
          <h3 style={{ 
            color: 'var(--text-primary)', 
            margin: '0 0 20px 0',
            padding: 0,
            fontSize: '20px',
            fontWeight: '600',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: 0.85
          }}>
            Create New Room
          </h3>
          <form onSubmit={handleCreateRoom}>
            <input
              type="text"
              placeholder="ROOM NAME (OPTIONAL)"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value.toUpperCase())}
              disabled={disabled}
              style={{ 
                width: '100%', 
                marginBottom: '18px',
                padding: '14px 16px',
                fontSize: '15px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                fontWeight: '600',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'all 0.2s ease',
                textAlign: 'center'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(34, 197, 94, 0.5)';
                e.target.style.boxShadow = '0 0 0 3px rgba(34, 197, 94, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border-color)';
                e.target.style.boxShadow = 'none';
              }}
            />
            <button 
              type="submit"
              disabled={disabled}
              className="btn-info touch-friendly"
              style={{ 
                width: '100%',
                padding: window.innerWidth <= 768 ? '16px' : '14px',
                fontSize: window.innerWidth <= 768 ? '16px' : '16px',
                fontWeight: '700',
                minHeight: '48px',
                touchAction: 'manipulation'
              }}
            >
               Create Room
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

        {/* Join Public Room Section */}
        <div style={{
          padding: '28px',
          background: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '1.5px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 4px 16px rgba(59, 130, 246, 0.08)',
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.12)';
          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.08)';
          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
        }}
        >
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '100px',
            height: '100px',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.05) 0%, transparent 70%)',
            borderRadius: '50%'
          }}></div>
          <h3 style={{ 
            color: 'var(--text-primary)', 
            margin: '0 0 20px 0',
            padding: 0,
            fontSize: '20px',
            fontWeight: '600',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: 0.85
          }}>
            Join Existing Room
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
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                fontWeight: '600',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'all 0.2s ease',
                textAlign: 'center'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border-color)';
                e.target.style.boxShadow = 'none';
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
               Join Room
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

        {/* Create Private Room Section */}
        <div style={{
          padding: '28px',
          background: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '1.5px solid rgba(168, 85, 247, 0.3)',
          boxShadow: '0 4px 16px rgba(168, 85, 247, 0.08)',
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}
        >
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '100px',
            height: '100px',
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.05) 0%, transparent 70%)',
            borderRadius: '50%'
          }}></div>
          <h3 style={{ 
            color: 'var(--text-primary)', 
            margin: '0 0 20px 0',
            padding: 0,
            fontSize: '20px',
            fontWeight: '600',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: 0.85
          }}>
            🔒 Create Private Room
          </h3>
          <form onSubmit={handleCreatePrivateRoom}>
            <input
              type="text"
              placeholder="ROOM NAME (OPTIONAL)"
              value={privateRoomName}
              onChange={(e) => setPrivateRoomName(e.target.value.toUpperCase())}
              disabled={disabled}
              style={{ 
                width: '100%', 
                marginBottom: '12px',
                padding: '14px 16px',
                fontSize: '15px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                fontWeight: '600',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'all 0.2s ease',
                textAlign: 'center'
              }}
            />
            <input
              type="password"
              placeholder="PASSWORD (REQUIRED)"
              value={privateRoomPassword}
              onChange={(e) => setPrivateRoomPassword(e.target.value)}
              disabled={disabled}
              style={{ 
                width: '100%', 
                marginBottom: '18px',
                padding: '14px 16px',
                fontSize: '15px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'all 0.2s ease',
                textAlign: 'center'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(168, 85, 247, 0.5)';
                e.target.style.boxShadow = '0 0 0 3px rgba(168, 85, 247, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border-color)';
                e.target.style.boxShadow = 'none';
              }}
            />
            <button 
              type="submit"
              disabled={disabled || !privateRoomPassword.trim()}
              className="btn-success touch-friendly"
              style={{ 
                width: '100%',
                padding: window.innerWidth <= 768 ? '16px' : '14px',
                fontSize: window.innerWidth <= 768 ? '16px' : '16px',
                fontWeight: '700',
                minHeight: '48px',
                touchAction: 'manipulation',
                opacity: (disabled || !privateRoomPassword.trim()) ? 0.6 : 1,
                cursor: (disabled || !privateRoomPassword.trim()) ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
                border: 'none'
              }}
            >
              🔒 Create Private Room
            </button>
          </form>
          <p style={{ 
            fontSize: '13px', 
            color: 'var(--text-secondary)', 
            marginTop: '16px',
            textAlign: 'center',
            lineHeight: '1.5'
          }}>
            Create a password-protected room for private watch parties with video+voice chat
          </p>
        </div>

        {/* Join Private Room Section */}
        <div style={{
          padding: '28px',
          background: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '1.5px solid rgba(168, 85, 247, 0.3)',
          boxShadow: '0 4px 16px rgba(168, 85, 247, 0.08)',
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}
        >
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '100px',
            height: '100px',
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.05) 0%, transparent 70%)',
            borderRadius: '50%'
          }}></div>
          <h3 style={{ 
            color: 'var(--text-primary)', 
            margin: '0 0 20px 0',
            padding: 0,
            fontSize: '20px',
            fontWeight: '600',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: 0.85
          }}>
            🔒 Join Private Room
          </h3>
          <form onSubmit={handleJoinPrivateRoom}>
            <input
              type="text"
              placeholder="ENTER ROOM CODE..."
              value={joinPrivateRoomId}
              onChange={(e) => setJoinPrivateRoomId(e.target.value.toUpperCase())}
              disabled={disabled}
              style={{ 
                width: '100%', 
                marginBottom: '12px',
                padding: '14px 16px',
                fontSize: '15px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                fontWeight: '600',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'all 0.2s ease',
                textAlign: 'center'
              }}
              maxLength={6}
            />
            <input
              type="password"
              placeholder="ENTER PASSWORD..."
              value={joinPrivateRoomPassword}
              onChange={(e) => setJoinPrivateRoomPassword(e.target.value)}
              disabled={disabled}
              style={{ 
                width: '100%', 
                marginBottom: '18px',
                padding: '14px 16px',
                fontSize: '15px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'all 0.2s ease',
                textAlign: 'center'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(168, 85, 247, 0.5)';
                e.target.style.boxShadow = '0 0 0 3px rgba(168, 85, 247, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border-color)';
                e.target.style.boxShadow = 'none';
              }}
            />
            <button 
              type="submit"
              disabled={disabled || !joinPrivateRoomId.trim() || !joinPrivateRoomPassword.trim()}
              className="btn-info touch-friendly"
              style={{ 
                width: '100%',
                padding: window.innerWidth <= 768 ? '16px' : '14px',
                fontSize: window.innerWidth <= 768 ? '16px' : '16px',
                fontWeight: '700',
                opacity: (disabled || !joinPrivateRoomId.trim() || !joinPrivateRoomPassword.trim()) ? 0.6 : 1,
                cursor: (disabled || !joinPrivateRoomId.trim() || !joinPrivateRoomPassword.trim()) ? 'not-allowed' : 'pointer',
                minHeight: '48px',
                touchAction: 'manipulation',
                background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
                border: 'none'
              }}
            >
              🔒 Join Private Room
            </button>
          </form>
          <p style={{ 
            fontSize: '13px', 
            color: 'var(--text-secondary)', 
            marginTop: '16px',
            textAlign: 'center',
            lineHeight: '1.5'
          }}>
            Enter the room code and password to join a private room with video+voice chat
          </p>
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
              <span style={{ fontSize: '28px' }}></span>
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
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
                marginBottom: '20px',
                borderRadius: '8px',
                border: modalUsername.trim() && !modalUsername.trim().startsWith('Guest-')
                  ? '2px solid rgba(34, 197, 94, 0.6)'
                  : '2px solid rgba(239, 68, 68, 0.6)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                if (modalUsername.trim() && !modalUsername.trim().startsWith('Guest-')) {
                  e.target.style.borderColor = 'rgba(34, 197, 94, 0.8)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(34, 197, 94, 0.1)';
                } else {
                  e.target.style.borderColor = 'rgba(239, 68, 68, 0.8)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
                }
              }}
              onBlur={(e) => {
                e.target.style.boxShadow = 'none';
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
                    ? 'linear-gradient(135deg, #007bff, #0056b3)'
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
