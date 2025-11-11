import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useTheme } from './contexts/ThemeContext';
import { useNotifications } from './components/NotificationSystem';
import VideoPlayer from './components/VideoPlayer';
import RoomControls from './components/RoomControls';
import VoiceChat from './components/VoiceChat';
import Reactions from './components/Reactions';
import { NotificationSettingsButton } from './components/NotificationSystem';

const SOCKET_SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

function App() {
  const { toggleTheme, isDark } = useTheme();
  const { showNotification, NOTIFICATION_TYPES } = useNotifications();
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState('Welcome to Watch Party Pro! 🎬');
  const [userId, setUserId] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [roomTimer, setRoomTimer] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [pendingRoomFromUrl, setPendingRoomFromUrl] = useState(null);
  const [showRoomClosedModal, setShowRoomClosedModal] = useState(false);
  const [roomClosedMessage, setRoomClosedMessage] = useState('');
  const videoPlayerRef = useRef();

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
      
      const roomToJoin = urlRoomId || savedRoomId;
      
      // Auto-rejoin if we have room ID and valid username
      if (roomToJoin && savedUsername && savedUsername.trim() !== '' && !savedUsername.startsWith('Guest-')) {
        console.log('🔄 Auto-rejoining room:', roomToJoin, 'with username:', savedUsername);
        setStatus('Reconnecting to room...');
        
        newSocket.emit('join_room', roomToJoin, { username: savedUsername.trim() }, (response) => {
          if (response.success) {
            setRoomId(roomToJoin);
            setRoomData(response.room);
            setUsers(response.room.users?.filter(u => u.userId !== newSocket.id) || []);
            setStatus(`🎉 Reconnected to room: ${response.room.name || roomToJoin}`);
            
            // Update saved room data
            localStorage.setItem('watchParty_roomId', roomToJoin);
            localStorage.setItem('watchParty_roomData', JSON.stringify(response.room));
            
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
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
      } else if (urlRoomId) {
        // Always show name modal when joining via URL
        // This ensures users always provide/confirm their name when joining via shared link
        console.log('📋 Room ID from URL - showing name modal:', urlRoomId);
        setPendingRoomFromUrl(urlRoomId);
        setStatus('Please enter your name to join the room');
        // Clean URL immediately
        window.history.replaceState({}, '', window.location.pathname);
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
    if (roomId) return { icon: '🟢', text: 'In Room', color: '#28a745' };
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

  // Room Timer Functions
  const startTimer = (minutes) => {
    if (!socket || !roomId) return;
    
    const seconds = minutes * 60;
    setTimerSeconds(seconds);
    setIsTimerRunning(true);
    
    // Emit timer start to server
    socket.emit('room_timer_start', { roomId, seconds });
  };

  const stopTimer = () => {
    if (!socket || !roomId) return;
    
    setIsTimerRunning(false);
    setTimerSeconds(0);
    if (roomTimer) {
      clearInterval(roomTimer);
      setRoomTimer(null);
    }
    
    // Emit timer stop to server
    socket.emit('room_timer_stop', { roomId });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Timer countdown effect
  useEffect(() => {
    if (isTimerRunning && timerSeconds > 0) {
      const interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            clearInterval(interval);
            // Timer finished - could trigger video play or notification
            if (videoPlayerRef.current?.current) {
              // Auto-play video when timer ends (if user interaction allows)
              videoPlayerRef.current.current.play().catch(() => {
                // Browser restrictions - user will need to click play
              });
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      setRoomTimer(interval);
      return () => clearInterval(interval);
    }
  }, [isTimerRunning, timerSeconds]);

  // Listen for timer events from server
  useEffect(() => {
    if (!socket) return;

    const handleTimerStart = (data) => {
      setTimerSeconds(data.seconds);
      setIsTimerRunning(true);
    };

    const handleTimerStop = () => {
      setIsTimerRunning(false);
      setTimerSeconds(0);
      if (roomTimer) {
        clearInterval(roomTimer);
        setRoomTimer(null);
      }
    };

    socket.on('room_timer_start', handleTimerStart);
    socket.on('room_timer_stop', handleTimerStop);
    
    // Handle room deletion when last user leaves
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
      socket.off('room_timer_start', handleTimerStart);
      socket.off('room_timer_stop', handleTimerStop);
      socket.off('room_deleted', handleRoomDeleted);
    };
  }, [socket, roomTimer, roomId]);

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
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
        borderRadius: window.innerWidth <= 768 ? '16px' : '24px',
        boxShadow: 
          '0 20px 60px rgba(102, 126, 234, 0.4), 0 0 40px rgba(139, 92, 246, 0.3)',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        flexWrap: window.innerWidth <= 768 ? 'wrap' : 'nowrap',
        gap: window.innerWidth <= 768 ? '12px' : '0'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: window.innerWidth <= 768 ? '24px' : '32px', 
            fontWeight: '800',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
            letterSpacing: '-0.5px'
          }}>
            🎬 Watch Party Pro
          </h1>
          <p style={{ 
            margin: '8px 0 0 0', 
            opacity: 0.95,
            fontSize: window.innerWidth <= 768 ? '13px' : '15px',
            fontWeight: '400',
            textShadow: '0 1px 5px rgba(0, 0, 0, 0.2)'
          }}>
            Watch movies together with friends in real-time
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
              border: 'none',
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              color: 'white',
              cursor: 'pointer',
              fontSize: window.innerWidth <= 768 ? '13px' : '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              minHeight: '44px',
              touchAction: 'manipulation'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.3)';
              e.target.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.2)';
              e.target.style.transform = 'translateY(0)';
            }}
            title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
          >
            {isDark ? '☀️' : '🌙'} {isDark ? 'Light' : 'Dark'}
          </button>
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            padding: '10px 18px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}>
            {connectionStatus.icon} {connectionStatus.text}
          </div>
        </div>
        
        {/* Decorative background elements */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          borderRadius: '50%'
        }}></div>
        <div style={{
          position: 'absolute',
          bottom: '-30%',
          left: '-5%',
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
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
                  
                  {/* Room Name */}
                  {roomData?.name && (
                    <div style={{ 
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
                      background: 'var(--info-color)',
                      color: 'white',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      letterSpacing: '1px',
                      fontFamily: 'monospace'
                    }}>
                      {roomId}
                    </span>
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
            
            {/* Voice Chat */}
            <VoiceChat 
              socket={socket}
              roomId={roomId}
              currentUser={userId}
              users={users}
            />
            
            {/* Participants Card */}
            <div className="component-card" style={{ marginBottom: 0 }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700' }}>
                👥 Participants ({users.length + 1})
              </h3>
              <div className="user-list" style={{ flexDirection: 'column', gap: '8px' }}>
                <div style={{ 
                  padding: '10px 12px',
                  background: roomData?.host === userId ? 
                    (isDark ? 'linear-gradient(135deg, rgba(255, 193, 7, 0.2), rgba(224, 168, 0, 0.2))' : 'linear-gradient(135deg, rgba(255, 193, 7, 0.15), rgba(224, 168, 0, 0.15))') :
                    (isDark ? 'linear-gradient(135deg, rgba(0, 123, 255, 0.2), rgba(0, 86, 179, 0.2))' : 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.15))'),
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: roomData?.host === userId ? 'var(--warning-color)' : 'var(--info-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  position: 'relative'
                }}>
                  <span style={{
                    width: '10px',
                    height: '10px',
                    background: 'var(--success-color)',
                    borderRadius: '50%',
                    border: `2px solid ${isDark ? 'white' : 'var(--bg-secondary)'}`,
                    boxShadow: `0 0 0 2px var(--bg-secondary)`
                  }}></span>
                  <span style={{ flex: 1, fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>
                    You {roomData?.host === userId && '👑'}
                  </span>
                  {roomData?.host === userId && (
                    <span style={{ fontSize: '12px', color: 'var(--warning-color)' }}>HOST</span>
                  )}
                </div>
                {users.map(user => (
                  <div key={user.userId} style={{ 
                    padding: '10px 12px',
                    background: user.isHost ? 
                      (isDark ? 'linear-gradient(135deg, rgba(255, 193, 7, 0.2), rgba(224, 168, 0, 0.2))' : 'linear-gradient(135deg, rgba(255, 193, 7, 0.15), rgba(224, 168, 0, 0.15))') :
                      (isDark ? 'linear-gradient(135deg, rgba(40, 167, 69, 0.2), rgba(32, 201, 151, 0.2))' : 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.15))'),
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: user.isHost ? 'var(--warning-color)' : 'var(--success-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{
                      width: '10px',
                      height: '10px',
                      background: 'var(--success-color)',
                      borderRadius: '50%',
                      border: `2px solid ${isDark ? 'white' : 'var(--bg-secondary)'}`,
                      boxShadow: `0 0 0 2px var(--bg-secondary)`
                    }}></span>
                    <span style={{ flex: 1, fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>
                      {user.username} {user.isHost && '👑'}
                    </span>
                    {user.isHost && (
                      <span style={{ fontSize: '12px', color: 'var(--warning-color)' }}>HOST</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Room Timer Card */}
            {roomId && (
              <div className="component-card" style={{ 
                marginBottom: 0,
                background: isTimerRunning ? 'linear-gradient(135deg, rgba(40, 167, 69, 0.15), rgba(32, 201, 151, 0.15))' : 'var(--bg-secondary)',
                border: isTimerRunning ? '2px solid #28a745' : '1px solid var(--border-color)'
              }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700' }}>⏰ Timer</h3>
                {isTimerRunning ? (
                  <div style={{ 
                    fontSize: '36px', 
                    fontWeight: 'bold', 
                    color: '#28a745', 
                    fontFamily: 'monospace',
                    textAlign: 'center',
                    marginBottom: '16px',
                    padding: '12px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '8px'
                  }}>
                    {formatTime(timerSeconds)}
                  </div>
                ) : (
                  <div style={{ 
                    fontSize: '14px', 
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    marginBottom: '16px',
                    padding: '12px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '8px'
                  }}>
                    No timer active
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {!isTimerRunning ? (
                    <>
                      <button
                        onClick={() => startTimer(1)}
                        className="btn-success"
                        style={{ width: '100%', padding: '10px', fontSize: '13px' }}
                      >
                        Start 1 min
                      </button>
                      <button
                        onClick={() => startTimer(5)}
                        className="btn-success"
                        style={{ width: '100%', padding: '10px', fontSize: '13px' }}
                      >
                        Start 5 min
                      </button>
                      <button
                        onClick={() => startTimer(10)}
                        className="btn-success"
                        style={{ width: '100%', padding: '10px', fontSize: '13px' }}
                      >
                        Start 10 min
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={stopTimer}
                      className="btn-danger"
                      style={{ width: '100%', padding: '10px', fontSize: '13px' }}
                    >
                      Stop Timer
                    </button>
                  )}
                </div>
                {isTimerRunning && timerSeconds <= 10 && (
                  <div style={{ 
                    marginTop: '12px', 
                    padding: '10px', 
                    background: '#dc3545', 
                    borderRadius: '8px',
                    color: '#fff',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    animation: 'pulse 1s infinite'
                  }}>
                    ⚠️ Timer ending soon!
                  </div>
                )}
              </div>
            )}
            
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

      {/* Video Support Disclaimer */}
      <div className="warning-message" style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        marginTop: '40px',
        marginBottom: '20px'
      }}>
        <strong>📺 Video Support:</strong> You can now watch YouTube videos together! 
        Simply paste any YouTube URL in the video player. Direct MP4 videos are also supported.
      </div>

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
          🎬 Watch Party Pro
        </p>
        <p style={{ 
          fontSize: '13px', 
          margin: '8px 0',
          color: 'var(--text-secondary)'
        }}>
          Built with React, Socket.IO, and WebRTC
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
        <p style={{ 
          fontSize: '12px', 
          marginTop: '16px', 
          color: 'var(--text-muted)',
          fontStyle: 'italic'
        }}>
          💡 Tip: Use direct MP4 video URLs for best compatibility. YouTube links won't work.
        </p>
      </div>
    </div>
  );
}

export default App;