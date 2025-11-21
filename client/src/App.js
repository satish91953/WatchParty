import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useTheme } from './contexts/ThemeContext';
import { useNotifications } from './components/NotificationSystem';
import VideoPlayer from './components/VideoPlayer';
import RoomControls from './components/RoomControls';
import VoiceChat from './components/VoiceChat';
import Reactions from './components/Reactions';
import TermsOfService from './components/TermsOfService';
import PrivacyPolicy from './components/PrivacyPolicy';
import { NotificationSettingsButton } from './components/NotificationSystem';

// Audio Level Bars Component
const AudioLevelBars = ({ userId }) => {
  const [levels, setLevels] = useState([8, 10, 12, 10, 8]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setLevels([
        8 + Math.random() * 8,
        10 + Math.random() * 10,
        12 + Math.random() * 8,
        10 + Math.random() * 8,
        8 + Math.random() * 8
      ]);
    }, 150);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '3px',
      height: '20px',
      marginRight: '8px'
    }}>
      {levels.map((height, idx) => (
        <div
          key={idx}
          style={{
            width: '3px',
            height: `${height}px`,
            background: 'var(--info-color)',
            borderRadius: '2px',
            transition: 'height 0.15s ease'
          }}
        />
      ))}
    </div>
  );
};

const SOCKET_SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

function App() {
  const { toggleTheme, isDark } = useTheme();
  const { showNotification, NOTIFICATION_TYPES } = useNotifications();
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState('Welcome to StreamTogether! 🎬');
  const [userId, setUserId] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [pendingRoomFromUrl, setPendingRoomFromUrl] = useState(null);
  const [showRoomClosedModal, setShowRoomClosedModal] = useState(false);
  const [roomClosedMessage, setRoomClosedMessage] = useState('');
  const videoPlayerRef = useRef();
  const [peerVolumes, setPeerVolumes] = useState({});
  const [peerMuted, setPeerMuted] = useState({});
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const newSocket = io(SOCKET_SERVER_URL, {
      auth: {
        token: token
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      setUserId(newSocket.id);
      setConnectionError('');
      
      // Check if we have a saved room to reconnect to
      const savedRoomId = localStorage.getItem('watchParty_roomId');
      const savedUsername = localStorage.getItem('watchParty_username') || '';
      
      // Also check URL parameter for room code
      const urlParams = new URLSearchParams(window.location.search);
      const urlRoomId = urlParams.get('room');
      
      // PRIORITY 1: If joining via shared link (URL), ALWAYS show name modal
      // This ensures users always provide/confirm their name when joining via shared link
      // Even if they have a saved username, they should confirm it for the new room
      if (urlRoomId) {
        console.log('📋 Room ID from URL - showing name modal:', urlRoomId);
        setPendingRoomFromUrl(urlRoomId);
        setStatus('Please enter your name to join the room');
        // Clean URL immediately
        window.history.replaceState({}, '', window.location.pathname);
      }
      // PRIORITY 2: Auto-rejoin if we have saved room ID (same room) and valid username
      // Only auto-rejoin if it's the same room (savedRoomId), not a new room from URL
      else if (savedRoomId && savedUsername && savedUsername.trim() !== '' && !savedUsername.startsWith('Guest-')) {
        console.log('🔄 Auto-rejoining saved room:', savedRoomId, 'with username:', savedUsername);
        setStatus('Reconnecting to room...');
        
        newSocket.emit('join_room', savedRoomId, { username: savedUsername.trim() }, (response) => {
          if (response.success) {
            setRoomId(savedRoomId);
            setRoomData(response.room);
            setUsers(response.room.users?.filter(u => u.userId !== newSocket.id) || []);
            setStatus(`🎉 Reconnected to room: ${response.room.name || savedRoomId}`);
            
            // Update saved room data
            localStorage.setItem('watchParty_roomId', savedRoomId);
            localStorage.setItem('watchParty_roomData', JSON.stringify(response.room));
          } else {
            // Room might not exist anymore, clear saved data
            console.log('❌ Failed to reconnect:', response.message);
            localStorage.removeItem('watchParty_roomId');
            localStorage.removeItem('watchParty_roomData');
            
            // If room was deleted, show the room closed modal
            if (response.message && (response.message.includes('closed') || response.message.includes('deleted'))) {
              setRoomClosedMessage(response.message);
              setShowRoomClosedModal(true);
            } else {
              setStatus('Connected to server! Ready to create or join a room.');
            }
          }
        });
      } else if (savedRoomId && (!savedUsername || savedUsername.trim() === '' || savedUsername.startsWith('Guest-'))) {
        // Have room ID but no valid username - clear room data
        console.log('⚠️ Have room ID but no valid username, clearing saved room data');
        localStorage.removeItem('watchParty_roomId');
        localStorage.removeItem('watchParty_roomData');
        setStatus('Connected to server! Ready to create or join a room.');
      } else {
        setStatus('Connected to server! Ready to create or join a room.');
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
      setStatus('Disconnected from server. Trying to reconnect...');
    });

    newSocket.on('reconnect', () => {
      console.log('Reconnected to server');
      setIsConnected(true);
      setUserId(newSocket.id);
      
      // Try to rejoin room if we were in one
      const savedRoomId = localStorage.getItem('watchParty_roomId');
      const savedUsername = localStorage.getItem('watchParty_username') || '';
      
      if (savedRoomId && savedUsername && savedUsername.trim() !== '' && !savedUsername.startsWith('Guest-')) {
        console.log('Rejoining room after reconnect:', savedRoomId);
        setStatus('Reconnecting to room...');
        newSocket.emit('join_room', savedRoomId, { username: savedUsername.trim() }, (response) => {
          if (response.success) {
            setRoomId(savedRoomId);
            setRoomData(response.room);
            setUsers(response.room.users?.filter(u => u.userId !== newSocket.id) || []);
            setStatus(`🎉 Reconnected to room: ${response.room.name || savedRoomId}`);
            localStorage.setItem('watchParty_roomData', JSON.stringify(response.room));
          } else {
            console.log('Failed to reconnect:', response.message);
            localStorage.removeItem('watchParty_roomId');
            localStorage.removeItem('watchParty_roomData');
            setStatus('Connected to server! Ready to create or join a room.');
          }
        });
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionError(`Cannot connect to server. Make sure the server is running on ${SOCKET_SERVER_URL}`);
      setIsConnected(false);
    });

    newSocket.on('user_joined', (data) => {
      console.log('User joined:', data.username);
      setUsers(prev => {
        // Avoid duplicates
        const filtered = prev.filter(u => u.userId !== data.userId && u.socketId !== data.socketId);
        return [...filtered, {
          userId: data.userId,
          socketId: data.socketId || data.userId, // Use socketId if provided, fallback to userId
          username: data.username
        }];
      });
      setStatus(`${data.username} joined the room! 👋`);
      
      // Show notification
      showNotification({
        type: NOTIFICATION_TYPES.SUCCESS,
        title: 'User Joined',
        message: `${data.username} joined the room!`,
        icon: '👋',
        key: 'userJoined',
        duration: 3000
      });
    });

    newSocket.on('user_left', (data) => {
      console.log('User left:', data.username);
      setUsers(prev => prev.filter(u => u.userId !== data.userId));
      setStatus(`${data.username} left the room 👋`);
      
      // Show notification
      showNotification({
        type: NOTIFICATION_TYPES.INFO,
        title: 'User Left',
        message: `${data.username} left the room`,
        icon: '👋',
        key: 'userLeft',
        duration: 3000
      });
    });

    return () => newSocket.close();
  }, [showNotification, NOTIFICATION_TYPES]);

  // Update localStorage when roomData changes
  useEffect(() => {
    if (roomId && roomData) {
      localStorage.setItem('watchParty_roomId', roomId);
      localStorage.setItem('watchParty_roomData', JSON.stringify(roomData));
    }
  }, [roomId, roomData]);

  const createRoom = (roomName, username) => {
    if (!socket) return;
    
    // Ensure username is provided and not empty
    if (!username || username.trim() === '' || username.startsWith('Guest-')) {
      alert('Please enter your name before creating a room');
      return;
    }
    
    setStatus('Creating room...');
    socket.emit('create_room', { roomName, username: username.trim() }, (response) => {
      if (response.success) {
        setRoomId(response.roomId);
        setRoomData(response.room);
        setUsers(response.room.users?.filter(u => u.userId !== socket.id) || []);
        const savedUsername = localStorage.getItem('watchParty_username') || 'You';
        setStatus(`🎉 Room created by ${savedUsername}! Share this code with friends: ${response.roomId}`);
        
        // Save room data to localStorage
        localStorage.setItem('watchParty_roomId', response.roomId);
        localStorage.setItem('watchParty_roomData', JSON.stringify(response.room));
      } else {
        setStatus('❌ Failed to create room. Please try again.');
      }
    });
  };

  const joinRoom = (targetRoomId, username) => {
    if (!socket || !targetRoomId.trim()) return;
    
    // Ensure username is provided and not empty
    if (!username || username.trim() === '' || username.startsWith('Guest-')) {
      alert('Please enter your name before joining the room');
      return;
    }
    
    setStatus('Joining room...');
    socket.emit('join_room', targetRoomId.trim(), { username: username.trim() }, (response) => {
      if (response.success) {
        setRoomId(targetRoomId.trim());
        setRoomData(response.room);
        setUsers(response.room.users?.filter(u => u.userId !== socket.id) || []);
        setStatus(`🎉 Successfully joined room: ${response.room.name || targetRoomId.trim()}`);
        
        // Save room data to localStorage
        localStorage.setItem('watchParty_roomId', targetRoomId.trim());
        localStorage.setItem('watchParty_roomData', JSON.stringify(response.room));
      } else {
        setStatus(`❌ Failed to join room: ${response.message}`);
        
        // Show popup if room is closed/deleted
        if (response.message && (response.message.includes('closed') || response.message.includes('deleted'))) {
          setRoomClosedMessage(response.message);
          setShowRoomClosedModal(true);
        }
      }
    });
  };

  const createPrivateRoom = (roomName, username, password) => {
    if (!socket) return;
    
    // Ensure username is provided and not empty
    if (!username || username.trim() === '' || username.startsWith('Guest-')) {
      alert('Please enter your name before creating a room');
      return;
    }
    
    if (!password || password.trim() === '') {
      alert('Please enter a password for the private room');
      return;
    }
    
    setStatus('Creating private room...');
    socket.emit('create_room', { 
      roomName, 
      username: username.trim(),
      isPrivate: true,
      password: password.trim()
    }, (response) => {
      if (response.success) {
        setRoomId(response.roomId);
        setRoomData(response.room);
        setUsers(response.room.users?.filter(u => u.userId !== socket.id) || []);
        const savedUsername = localStorage.getItem('watchParty_username') || 'You';
        setStatus(`🔒 Private room created by ${savedUsername}! Share this code with friends: ${response.roomId}`);
        
        // Save room data to localStorage
        localStorage.setItem('watchParty_roomId', response.roomId);
        localStorage.setItem('watchParty_roomData', JSON.stringify(response.room));
      } else {
        setStatus('❌ Failed to create private room. Please try again.');
      }
    });
  };

  const joinPrivateRoom = (targetRoomId, username, password) => {
    if (!socket || !targetRoomId.trim()) return;
    
    // Ensure username is provided and not empty
    if (!username || username.trim() === '' || username.startsWith('Guest-')) {
      alert('Please enter your name before joining the room');
      return;
    }
    
    if (!password || password.trim() === '') {
      alert('Please enter the room password');
      return;
    }
    
    setStatus('Joining private room...');
    socket.emit('join_room', targetRoomId.trim(), { 
      username: username.trim(),
      password: password.trim()
    }, (response) => {
      if (response.success) {
        setRoomId(targetRoomId.trim());
        setRoomData(response.room);
        setUsers(response.room.users?.filter(u => u.userId !== socket.id) || []);
        setStatus(`🔒 Successfully joined private room: ${response.room.name || targetRoomId.trim()}`);
        
        // Save room data to localStorage
        localStorage.setItem('watchParty_roomId', targetRoomId.trim());
        localStorage.setItem('watchParty_roomData', JSON.stringify(response.room));
      } else {
        setStatus(`❌ Failed to join private room: ${response.message}`);
        
        // Show popup if room is closed/deleted or password is wrong
        if (response.message && (response.message.includes('closed') || response.message.includes('deleted'))) {
          setRoomClosedMessage(response.message);
          setShowRoomClosedModal(true);
        }
        
        // Clear room data if join failed
        localStorage.removeItem('watchParty_roomId');
        localStorage.removeItem('watchParty_roomData');
      }
    });
  };

  const leaveRoom = () => {
    if (window.confirm('Are you sure you want to leave this room?')) {
      // Notify server that we're leaving
      if (socket && roomId) {
        socket.emit('leave_room', { roomId });
      }
      
      setRoomId('');
      setRoomData(null);
      setUsers([]);
      setStatus('Left the room. Create a new room or join another one!');
      
      // Clear saved room data
      localStorage.removeItem('watchParty_roomId');
      localStorage.removeItem('watchParty_roomData');
      
      // Refresh to clean up all connections
      setTimeout(() => window.location.reload(), 1000);
    }                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          
  };

  const getConnectionStatus = () => {
    if (!isConnected) return { icon: '🔴', text: 'Disconnected', color: '#dc3545' };
    if (roomId) return { icon: '🟢', text: 'Connected', color: '#28a745' };
    return { icon: '🟡', text: 'Connected', color: '#ffc107' };
  };

  const getRoomLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}?room=${roomId}`;
  };

  const copyRoomLink = async () => {
    try {
      const roomLink = getRoomLink();
      await navigator.clipboard.writeText(roomLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = getRoomLink();
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 3000);
      } catch (fallbackErr) {
        alert('Failed to copy link. Please copy manually: ' + getRoomLink());
      }
      document.body.removeChild(textArea);
    }
  };

  // Handle room deletion when last user leaves
  useEffect(() => {
    if (!socket) return;
    const handleRoomDeleted = (data) => {
      if (data.roomId === roomId) {
        setStatus('Room deleted - all users have left');
        setRoomId('');
        setRoomData(null);
        setUsers([]);
        
        // Clear saved room data
        localStorage.removeItem('watchParty_roomId');
        localStorage.removeItem('watchParty_roomData');
        
        // Show alert and redirect after a short delay
        setTimeout(() => {
          alert('Room has been deleted because all users left.');
          window.location.reload();
        }, 1000);
      }
    };
    
    socket.on('room_deleted', handleRoomDeleted);

    return () => {
      socket.off('room_deleted', handleRoomDeleted);
    };
  }, [socket, roomId]);

  const connectionStatus = getConnectionStatus();

  return (
    <div className="container">
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px',
        padding: window.innerWidth <= 768 ? '20px 16px' : '28px 36px',
        background: isDark 
          ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.12) 50%, rgba(240, 147, 251, 0.08) 100%)'
          : '#ffffff',
        backgroundColor: isDark ? 'var(--bg-secondary)' : '#ffffff',
        borderRadius: window.innerWidth <= 768 ? '16px' : '24px',
        boxShadow: isDark 
          ? '0 4px 20px rgba(102, 126, 234, 0.1)' 
          : '0 2px 12px rgba(0, 0, 0, 0.08)',
        color: 'var(--text-primary)',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        flexWrap: window.innerWidth <= 768 ? 'wrap' : 'nowrap',
        gap: window.innerWidth <= 768 ? '12px' : '0',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: window.innerWidth <= 768 ? '24px' : '32px', 
            fontWeight: '700',
            letterSpacing: '-0.5px',
            color: 'var(--text-primary)',
            opacity: 0.9
          }}>
            🎬 StreamTogether
          </h1>
          <p style={{ 
            margin: '8px 0 0 0', 
            opacity: 0.7,
            fontSize: window.innerWidth <= 768 ? '13px' : '15px',
            fontWeight: '400',
            color: 'var(--text-secondary)'
          }}>
            Synchronized Screens, Live Voices, Shared Moments
          </p>
        </div>
        
        <div style={{ 
          textAlign: 'right', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '15px',
          position: 'relative',
          zIndex: 1
        }}>
          <button
            onClick={toggleTheme}
            className="touch-friendly"
            style={{
              padding: window.innerWidth <= 768 ? '12px 16px' : '10px 18px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: window.innerWidth <= 768 ? '13px' : '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
              minHeight: '44px',
              touchAction: 'manipulation'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'var(--bg-secondary)';
              e.target.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'var(--bg-tertiary)';
              e.target.style.transform = 'translateY(0)';
            }}
            title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
          >
            {isDark ? '☀️' : '🌙'} {isDark ? 'Light' : 'Dark'}
          </button>
        </div>
        
        {/* Decorative background elements */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '300px',
          height: '300px',
          background: isDark 
            ? 'radial-gradient(circle, rgba(102, 126, 234, 0.03) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(102, 126, 234, 0.02) 0%, transparent 70%)',
          borderRadius: '50%'
        }}></div>
        <div style={{
          position: 'absolute',
          bottom: '-30%',
          left: '-5%',
          width: '200px',
          height: '200px',
          background: isDark 
            ? 'radial-gradient(circle, rgba(118, 75, 162, 0.02) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(118, 75, 162, 0.015) 0%, transparent 70%)',
          borderRadius: '50%'
        }}></div>
      </div>

      {/* Connection Error */}
      {connectionError && (
        <div className="error-message">
          <strong>Connection Error:</strong> {connectionError}
          <br />
          <small>Make sure to start the server with: cd server && npm run dev</small>
        </div>
      )}

      {!roomId ? (
        <>
        {/* Room Selection */}
          <RoomControls
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            onCreatePrivateRoom={createPrivateRoom}
            onJoinPrivateRoom={joinPrivateRoom}
            disabled={!isConnected}
            pendingRoomFromUrl={pendingRoomFromUrl}
            onPendingRoomHandled={() => setPendingRoomFromUrl(null)}
          />
        
        {/* Room Closed Modal */}
        {showRoomClosedModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(6px)'
          }}
          onClick={() => setShowRoomClosedModal(false)}
          >
            <div style={{
              background: isDark 
                ? 'linear-gradient(135deg, rgba(26, 26, 31, 0.98) 0%, rgba(37, 37, 45, 0.98) 100%)'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 249, 250, 0.98) 100%)',
              padding: '36px',
              borderRadius: '24px',
              border: '2px solid var(--border-color)',
              boxShadow: isDark 
                ? '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1) inset'
                : '0 20px 60px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05) inset',
              maxWidth: '450px',
              width: '90%',
              position: 'relative',
              zIndex: 10001,
              animation: 'fadeIn 0.3s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                textAlign: 'center',
                marginBottom: '24px'
              }}>
                <div style={{
                  fontSize: '64px',
                  marginBottom: '16px',
                  animation: 'pulse 2s infinite'
                }}>
                  🚫
                </div>
                <h3 style={{
                  margin: '0 0 12px 0',
                  fontSize: '26px',
                  fontWeight: '800',
                  color: 'var(--text-primary)',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  Room Closed
                </h3>
                <p style={{
                  margin: '0',
                  fontSize: '15px',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.6'
                }}>
                  {roomClosedMessage || 'This room has been closed or deleted because all users left.'}
                </p>
              </div>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <button
                  onClick={() => setShowRoomClosedModal(false)}
                  className="btn-info"
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    fontSize: '16px',
                    fontWeight: '700',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    background: 'var(--gradient-info)',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                  }}
                >
                  OK, Got It
                </button>
                <p style={{
                  margin: '8px 0 0 0',
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                  textAlign: 'center'
                }}>
                  💡 You can create a new room or join another one
                </p>
              </div>
            </div>
          </div>
        )}
        </>
      ) : (
        /* Main Room Interface - Professional Dashboard Layout */
        <div className="dashboard-layout">
          {/* Left Side - Video Player (Main Focus) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <VideoPlayer
              ref={videoPlayerRef}
              socket={socket}
              roomId={roomId}
              currentUser={userId}
              initialVideo={roomData?.currentVideo}
              isHost={roomData?.host === userId}
              room={roomData}
            />
          </div>

          {/* Right Sidebar - Communication & Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Voice Chat */}
            <VoiceChat 
              socket={socket}
              roomId={roomId}
              currentUser={userId}
              users={users}
            />
            
            {/* Room Status Panel */}
            {roomId && (
              <div className="component-card" style={{ marginBottom: 0 }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700' }}>
                  🏠 Room Info
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Status */}
                  <div style={{ 
                    padding: '10px 12px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: 'var(--text-primary)'
                  }}>
                    <strong>Status:</strong> {status}
                  </div>
                  
                  {/* Room Name and ID - Same Line */}
                  <div style={{ 
                    display: 'flex',
                    gap: '12px'
                  }}>
                    {/* Room Name */}
                    {roomData?.name && (
                      <div style={{ 
                        flex: 1,
                        padding: '10px 12px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: 'var(--text-primary)'
                      }}>
                        <strong>Room:</strong> {roomData.name}
                      </div>
                    )}
                    
                    {/* Room ID */}
                    <div style={{ 
                      flex: 1,
                      padding: '10px 12px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <strong>ID:</strong>
                      <span style={{
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        letterSpacing: '1px',
                        fontFamily: 'monospace'
                      }}>
                        {roomId}
                      </span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    <button 
                      onClick={copyRoomLink}
                      className="btn-success touch-friendly"
                      style={{ 
                        width: '100%',
                        padding: '10px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        minHeight: '40px'
                      }}
                    >
                      {linkCopied ? '✅ Copied!' : '🔗 Copy Link'}
                    </button>
                    <button 
                      onClick={leaveRoom}
                      className="btn-danger touch-friendly"
                      style={{ 
                        width: '100%',
                        padding: '10px',
                        fontSize: '13px',
                        minHeight: '40px'
                      }}
                    >
                      🔴 Leave Room
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Participants Card */}
            <div className="component-card" style={{ marginBottom: 0 }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                👥 Participants ({users.length + 1})
              </h3>
              <div className="user-list" style={{ flexDirection: 'column', gap: '12px' }}>
                {/* Current User */}
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 8px',
                  borderRadius: '8px',
                  width: '100%'
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '16px',
                    flexShrink: 0
                  }}>
                    {(() => {
                      const savedUsername = localStorage.getItem('watchParty_username') || 'You';
                      return savedUsername.charAt(0).toUpperCase();
                    })()}
                  </div>
                  
                  {/* Name */}
                  <span style={{ 
                    minWidth: '80px',
                    fontWeight: '500', 
                    fontSize: '14px', 
                    color: 'var(--text-primary)',
                    flexShrink: 0
                  }}>
                    You
                  </span>
                  
                  {/* Volume Bar - Simple horizontal bar for self */}
                  <div style={{
                    flex: 1,
                    maxWidth: '250px',
                    marginLeft: 'auto',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={100}
                      disabled
                      className="participant-volume-slider"
                      style={{
                        width: '100%'
                      }}
                    />
                  </div>
                </div>
                
                {/* Other Users */}
                {users.map((user, index) => {
                  // Generate consistent color based on username
                  const colors = [
                    'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                    'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                  ];
                  const colorIndex = index % colors.length;
                  
                  return (
                    <div 
                      key={user.userId} 
                      style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 8px',
                        borderRadius: '8px',
                        border: peerMuted[user.socketId || user.userId] ? '1px solid var(--accent-color)' : '1px solid transparent',
                        transition: 'border 0.2s ease',
                        width: '100%'
                      }}
                      onMouseEnter={(e) => {
                        if (!peerMuted[user.socketId || user.userId]) {
                          e.currentTarget.style.border = '1px solid var(--accent-color)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!peerMuted[user.socketId || user.userId]) {
                          e.currentTarget.style.border = '1px solid transparent';
                        }
                      }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: colors[colorIndex],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '16px',
                        flexShrink: 0
                      }}>
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      
                      {/* Name */}
                      <span style={{ 
                        minWidth: '80px',
                        fontWeight: '500', 
                        fontSize: '14px', 
                        color: 'var(--text-primary)',
                        flexShrink: 0
                      }}>
                        {user.username}
                      </span>
                      
                      {/* Volume Control - Slider for others */}
                      <div style={{
                        flex: 1,
                        maxWidth: '250px',
                        marginLeft: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={peerMuted[user.socketId || user.userId] ? 0 : (peerVolumes[user.socketId || user.userId] || 100)}
                          onChange={(e) => {
                            const volume = parseInt(e.target.value);
                            const peerId = user.socketId || user.userId;
                            setPeerVolumes(prev => ({ ...prev, [peerId]: volume }));
                            setPeerMuted(prev => ({ ...prev, [peerId]: volume === 0 }));
                            // Update audio element volume
                            const audio = document.querySelector(`audio[data-peer-id="${peerId}"]`);
                            if (audio) {
                              audio.volume = volume / 100;
                            }
                          }}
                          className="participant-volume-slider"
                          style={{
                            width: '100%'
                          }}
                        />
                        <button
                          onClick={() => {
                            const peerId = user.socketId || user.userId;
                            const isMuted = peerMuted[peerId] || false;
                            const currentVolume = peerVolumes[peerId] || 100;
                            setPeerMuted(prev => ({ ...prev, [peerId]: !isMuted }));
                            // Mute/unmute audio element
                            const audio = document.querySelector(`audio[data-peer-id="${peerId}"]`);
                            if (audio) {
                              if (!isMuted) {
                                // Mute
                                audio.volume = 0;
                              } else {
                                // Unmute - restore volume
                                audio.volume = currentVolume / 100;
                              }
                            }
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            color: peerMuted[user.socketId || user.userId] ? 'var(--error-color)' : 'var(--text-secondary)',
                            opacity: 0.7,
                            transition: 'opacity 0.2s ease',
                            flexShrink: 0
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.opacity = '1';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.opacity = '0.7';
                          }}
                          title={peerMuted[user.socketId || user.userId] ? 'Unmute' : 'Mute'}
                        >
                          {peerMuted[user.socketId || user.userId] ? '🔇' : '🔊'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notification Settings Button */}
            <NotificationSettingsButton />
          </div>
          
          {/* Reactions Overlay */}
          <Reactions
            socket={socket}
            roomId={roomId}
          />
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: '20px',
        padding: '30px',
        textAlign: 'center',
        background: 'var(--bg-secondary)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <p style={{
          margin: '0 0 12px 0',
          fontSize: '16px',
          fontWeight: '600',
          color: 'var(--text-primary)'
        }}>
          🎬 StreamTogether
        </p>
        <p style={{
          margin: '0 0 12px 0',
          fontSize: '14px',
          fontWeight: '400',
          color: 'var(--text-secondary)',
          opacity: 0.8
        }}>
          Synchronized Screens, Live Voices, Shared Moments
        </p>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '15px',
          marginTop: '12px',
          flexWrap: 'wrap'
        }}>
          <span style={{
            padding: '4px 12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '12px',
            fontSize: '12px',
            color: 'var(--text-secondary)'
          }}>
            Synchronized Video
          </span>
          <span style={{
            padding: '4px 12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '12px',
            fontSize: '12px',
            color: 'var(--text-secondary)'
          }}>
            Voice Chat
          </span>
          <span style={{
            padding: '4px 12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '12px',
            fontSize: '12px',
            color: 'var(--text-secondary)'
          }}>
            Reactions
          </span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '20px',
          marginTop: '20px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <button
            onClick={() => setShowTerms(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '4px 8px',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.color = 'var(--accent-color)'}
            onMouseLeave={(e) => e.target.style.color = 'var(--text-secondary)'}
          >
            Terms of Service
          </button>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <button
            onClick={() => setShowPrivacy(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '4px 8px',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.color = 'var(--accent-color)'}
            onMouseLeave={(e) => e.target.style.color = 'var(--text-secondary)'}
          >
            Privacy Policy
          </button>
        </div>
        <p style={{ 
          fontSize: '11px', 
          marginTop: '20px', 
          color: 'var(--text-muted)',
          opacity: 0.7
        }}>
          ⚠️ Disclaimer: YouTube videos are embedded via YouTube's official API. StreamTogether is not affiliated with YouTube. Content availability is subject to YouTube's Terms of Service.
        </p>
      </div>

      {/* Terms of Service Modal */}
      {showTerms && <TermsOfService onClose={() => setShowTerms(false)} />}

      {/* Privacy Policy Modal */}
      {showPrivacy && <PrivacyPolicy onClose={() => setShowPrivacy(false)} />}
    </div>
  );
}

export default App;