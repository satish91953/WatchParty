import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { useTheme } from './contexts/ThemeContext';
import VideoPlayer from './components/VideoPlayer';
import RoomControls from './components/RoomControls';
import VoiceChat from './components/VoiceChat';
import TextChat from './components/TextChat';
import Reactions from './components/Reactions';

const SOCKET_SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

function App() {
  const { theme, toggleTheme, isDark } = useTheme();
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState('Welcome to Watch Party Pro! 🎬');
  const [userId, setUserId] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [roomTimer, setRoomTimer] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
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
      const savedRoomData = localStorage.getItem('watchParty_roomData');
      
      // Also check URL parameter for room code
      const urlParams = new URLSearchParams(window.location.search);
      const urlRoomId = urlParams.get('room');
      
      const roomToJoin = urlRoomId || savedRoomId;
      
      if (roomToJoin && savedRoomData) {
        try {
          const roomData = JSON.parse(savedRoomData);
          console.log('Reconnecting to room:', roomToJoin);
          setStatus('Reconnecting to room...');
          
          // Rejoin the room
          newSocket.emit('join_room', roomToJoin, (response) => {
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
              console.log('Failed to reconnect:', response.message);
              localStorage.removeItem('watchParty_roomId');
              localStorage.removeItem('watchParty_roomData');
              setStatus('Connected to server! Ready to create or join a room.');
            }
          });
        } catch (error) {
          console.error('Error parsing saved room data:', error);
          localStorage.removeItem('watchParty_roomId');
          localStorage.removeItem('watchParty_roomData');
          setStatus('Connected to server! Ready to create or join a room.');
        }
      } else if (urlRoomId && !savedRoomData) {
        // Try to join room from URL if we don't have saved data
        console.log('Joining room from URL:', urlRoomId);
        setStatus('Joining room from link...');
        newSocket.emit('join_room', urlRoomId, (response) => {
          if (response.success) {
            setRoomId(urlRoomId);
            setRoomData(response.room);
            setUsers(response.room.users?.filter(u => u.userId !== newSocket.id) || []);
            setStatus(`🎉 Joined room: ${response.room.name || urlRoomId}`);
            localStorage.setItem('watchParty_roomId', urlRoomId);
            localStorage.setItem('watchParty_roomData', JSON.stringify(response.room));
            window.history.replaceState({}, '', window.location.pathname);
          } else {
            setStatus('Connected to server! Ready to create or join a room.');
          }
        });
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
      if (savedRoomId) {
        console.log('Rejoining room after reconnect:', savedRoomId);
        setStatus('Reconnecting to room...');
        newSocket.emit('join_room', savedRoomId, (response) => {
          if (response.success) {
            setRoomId(savedRoomId);
            setRoomData(response.room);
            setUsers(response.room.users?.filter(u => u.userId !== newSocket.id) || []);
            setStatus(`🎉 Reconnected to room: ${response.room.name || savedRoomId}`);
            localStorage.setItem('watchParty_roomData', JSON.stringify(response.room));
          } else {
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
        const filtered = prev.filter(u => u.userId !== data.userId);
        return [...filtered, {
          userId: data.userId,
          username: data.username
        }];
      });
      setStatus(`${data.username} joined the room! 👋`);
    });

    newSocket.on('user_left', (data) => {
      console.log('User left:', data.username);
      setUsers(prev => prev.filter(u => u.userId !== data.userId));
      setStatus(`${data.username} left the room 👋`);
    });

    return () => newSocket.close();
  }, []);

  // Update localStorage when roomData changes
  useEffect(() => {
    if (roomId && roomData) {
      localStorage.setItem('watchParty_roomId', roomId);
      localStorage.setItem('watchParty_roomData', JSON.stringify(roomData));
    }
  }, [roomId, roomData]);

  const createRoom = (roomName) => {
    if (!socket) return;
    
    setStatus('Creating room...');
    socket.emit('create_room', { roomName }, (response) => {
      if (response.success) {
        setRoomId(response.roomId);
        setRoomData(response.room);
        setUsers(response.room.users?.filter(u => u.userId !== socket.id) || []);
        setStatus(`🎉 Room created! Share this code with friends: ${response.roomId}`);
        
        // Save room data to localStorage
        localStorage.setItem('watchParty_roomId', response.roomId);
        localStorage.setItem('watchParty_roomData', JSON.stringify(response.room));
      } else {
        setStatus('❌ Failed to create room. Please try again.');
      }
    });
  };

  const joinRoom = (targetRoomId) => {
    if (!socket || !targetRoomId.trim()) return;
    
    setStatus('Joining room...');
    socket.emit('join_room', targetRoomId.trim(), (response) => {
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
      }
    });
  };

  const leaveRoom = () => {
    if (window.confirm('Are you sure you want to leave this room?')) {
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

    return () => {
      socket.off('room_timer_start', handleTimerStart);
      socket.off('room_timer_stop', handleTimerStop);
    };
  }, [socket, roomTimer]);

  const connectionStatus = getConnectionStatus();

  return (
    <div className="container">
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        padding: '24px 30px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '20px',
        boxShadow: '0 10px 30px rgba(102, 126, 234, 0.4)',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: '32px', 
            fontWeight: '800',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
            letterSpacing: '-0.5px'
          }}>
            🎬 Watch Party Pro
          </h1>
          <p style={{ 
            margin: '8px 0 0 0', 
            opacity: 0.95,
            fontSize: '15px',
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
            style={{
              padding: '10px 18px',
              borderRadius: '12px',
              border: 'none',
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
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

      {/* YouTube Info */}
      <div className="warning-message" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <strong>📺 Video Support:</strong> You can now watch YouTube videos together! 
        Simply paste any YouTube URL in the video player. Direct MP4 videos are also supported.
      </div>
      
      {/* Status Bar */}
      <div className="status">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ flex: 1 }}>
            <strong>Status:</strong> {status}
          </div>
          {roomId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{
                background: '#007bff',
                color: 'white',
                padding: '5px 12px',
                borderRadius: '15px',
                fontSize: '14px',
                fontWeight: 'bold',
                letterSpacing: '1px'
              }}>
                {roomId}
              </div>
              <button 
                onClick={copyRoomLink}
                className="btn-success"
                style={{ 
                  padding: '5px 12px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
                title="Copy room link"
              >
                {linkCopied ? '✅ Copied!' : '🔗 Copy Link'}
              </button>
              <button 
                onClick={() => setShowQRCode(!showQRCode)}
                className="btn-info"
                style={{ 
                  padding: '5px 12px',
                  fontSize: '12px'
                }}
                title="Show QR code"
              >
                {showQRCode ? '📱 Hide QR' : '📱 QR Code'}
              </button>
              <button 
                onClick={leaveRoom}
                className="btn-danger"
                style={{ 
                  padding: '5px 12px',
                  fontSize: '12px'
                }}
              >
                Leave Room
              </button>
            </div>
          )}
        </div>
        
        {roomData?.name && (
          <div style={{ marginTop: '8px', color: '#ccc' }}>
            <strong>Room:</strong> {roomData.name}
          </div>
        )}
        
        {/* QR Code Display */}
        {roomId && showQRCode && (
          <div style={{ 
            marginTop: '15px', 
            padding: '15px', 
            background: '#2a2a2a', 
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: '5px' }}>
              📱 Scan to Join Room
            </div>
            <div style={{ 
              background: 'white', 
              padding: '10px', 
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <QRCodeSVG 
                value={getRoomLink()} 
                size={150}
                level="M"
                includeMargin={true}
              />
            </div>
            <div style={{ fontSize: '11px', color: '#999', textAlign: 'center', maxWidth: '200px' }}>
              Share this QR code with friends to join instantly!
            </div>
            <div style={{ 
              fontSize: '10px', 
              color: '#666', 
              wordBreak: 'break-all',
              textAlign: 'center',
              maxWidth: '200px'
            }}>
              {getRoomLink()}
            </div>
          </div>
        )}

        {/* Room Timer */}
        {roomId && (
          <div style={{ 
            marginTop: '15px', 
            padding: '15px', 
            background: isTimerRunning ? '#2d5016' : '#2a2a2a', 
            borderRadius: '8px',
            border: isTimerRunning ? '2px solid #28a745' : '1px solid #444'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h4 style={{ margin: '0 0 10px 0', color: '#fff' }}>⏰ Room Timer</h4>
                {isTimerRunning ? (
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#28a745', fontFamily: 'monospace' }}>
                    {formatTime(timerSeconds)}
                  </div>
                ) : (
                  <div style={{ fontSize: '14px', color: '#999' }}>
                    No timer active
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {!isTimerRunning ? (
                  <>
                    <button
                      onClick={() => startTimer(1)}
                      className="btn-success"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      Start 1 min
                    </button>
                    <button
                      onClick={() => startTimer(5)}
                      className="btn-success"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      Start 5 min
                    </button>
                    <button
                      onClick={() => startTimer(10)}
                      className="btn-success"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      Start 10 min
                    </button>
                  </>
                ) : (
                  <button
                    onClick={stopTimer}
                    className="btn-danger"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    Stop Timer
                  </button>
                )}
              </div>
            </div>
            {isTimerRunning && timerSeconds <= 10 && (
              <div style={{ 
                marginTop: '10px', 
                padding: '8px', 
                background: '#dc3545', 
                borderRadius: '4px',
                color: '#fff',
                textAlign: 'center',
                fontWeight: 'bold',
                animation: 'pulse 1s infinite'
              }}>
                ⚠️ Timer ending soon!
              </div>
            )}
          </div>
        )}
      </div>

      {!roomId ? (
        /* Room Selection */
        <RoomControls
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          disabled={!isConnected}
        />
      ) : (
        /* Main Room Interface */
        <>
          {/* Users in Room */}
          <div className="component-card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <h3>👥 Users in Room ({users.length + 1})</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '12px', color: '#ccc' }}>
                  Room Code: <strong style={{ color: '#fff' }}>{roomId}</strong>
                </div>
                <button 
                  onClick={copyRoomLink}
                  className="btn-success"
                  style={{ 
                    padding: '4px 10px',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Copy room link to share"
                >
                  {linkCopied ? '✅ Copied!' : '🔗 Copy Link'}
                </button>
                <button 
                  onClick={() => setShowQRCode(!showQRCode)}
                  className="btn-info"
                  style={{ 
                    padding: '4px 10px',
                    fontSize: '11px'
                  }}
                  title="Show QR code for mobile"
                >
                  {showQRCode ? '📱 Hide' : '📱 QR'}
                </button>
              </div>
            </div>
            <div className="user-list">
              <span className="user-badge" style={{ 
                background: roomData?.host === userId ? 
                  'linear-gradient(135deg, #ffc107, #e0a800)' :
                  'linear-gradient(135deg, #007bff, #0056b3)',
                position: 'relative'
              }}>
                You ({userId?.substring(0, 8)}) {roomData?.host === userId && '👑 HOST'}
                <span style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  background: '#28a745',
                  borderRadius: '50%',
                  width: '12px',
                  height: '12px',
                  border: '2px solid white'
                }}></span>
              </span>
              {users.map(user => (
                <span key={user.userId} className="user-badge" style={{
                  background: user.isHost ? 
                    'linear-gradient(135deg, #ffc107, #e0a800)' : 
                    'linear-gradient(135deg, #28a745, #20c997)'
                }}>
                  {user.username} {user.isHost && '👑'}
                </span>
              ))}
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid-2">
            {/* Left Column - Video and Controls */}
            <div>
              <VoiceChat 
                socket={socket}
                roomId={roomId}
                currentUser={userId}
                users={users.map(u => u.userId)}
              />
              
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
            
            {/* Right Column - Chat */}
            <div>
              <TextChat
                socket={socket}
                roomId={roomId}
                currentUser={userId}
                messages={roomData?.messages || []}
              />
            </div>
          </div>
          
          {/* Reactions Overlay */}
          <Reactions
            socket={socket}
            roomId={roomId}
          />
        </>
      )}

      {/* Footer */}
      <div style={{
        marginTop: '60px',
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
            Text Chat
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