import React, { useEffect, useRef, useState, useCallback } from 'react';

// Dynamic import to handle potential issues with simple-peer
let Peer = null;

// Load simple-peer dynamically to avoid process errors
const loadPeer = async () => {
  if (!Peer) {
    try {
      const SimplePeer = await import('simple-peer');
      Peer = SimplePeer.default || SimplePeer;
    } catch (error) {
      console.error('Failed to load simple-peer:', error);
      return null;
    }
  }
  return Peer;
};

function VoiceChat({ socket, roomId, currentUser, users, roomData, noCard = false, onPeerVolumesChange, onPeerMuteChange }) {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [audioStream, setAudioStream] = useState(null);
  const [videoStream, setVideoStream] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [peerLoaded, setPeerLoaded] = useState(false);
  const [peerVolumes, setPeerVolumes] = useState({}); // Track volume per peer
  const [peerVideoStreams, setPeerVideoStreams] = useState({}); // Track video streams per peer
  const [videoSizes, setVideoSizes] = useState({}); // Track video frame sizes { local: {width, height}, peerId: {width, height} }
  const [videoPositions, setVideoPositions] = useState({}); // Track video frame positions { local: {x, y}, peerId: {x, y} }
  const [isResizing, setIsResizing] = useState(false);
  const [resizeTarget, setResizeTarget] = useState(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const peersRef = useRef([]);
  const volumeRef = useRef(100);
  const peerRetryTimers = useRef({});
  const peerConnectionTimeouts = useRef({});
  const peerVolumeRefs = useRef({}); // Store volume refs per peer
  const videoRefs = useRef({}); // Store video element refs per peer
  const localVideoRef = useRef(null); // Ref for local video element
  const videoContainerRefs = useRef({}); // Store container refs for resizing
  const dragPositionRef = useRef({ x: 0, y: 0 }); // Track position during drag to avoid flickering
  const isDraggingRef = useRef(false); // Track dragging state via ref to avoid re-renders
  const dragTargetRef = useRef(null); // Track drag target via ref
  const dragStartRef = useRef({ x: 0, y: 0 }); // Track drag start offset via ref
  
  // Check if room is private (enables video chat)
  const isPrivateRoom = roomData?.isPrivate || false;

  // Load Peer library on component mount
  useEffect(() => {
    loadPeer().then((PeerClass) => {
      if (PeerClass) {
        setPeerLoaded(true);
      } else {
        console.error('Could not load WebRTC peer library');
        setConnectionStatus('error');
      }
    });
  }, []);

  // Start or stop voice chat
  const toggleVoiceChat = async () => {
    if (!peerLoaded) {
      alert('Voice chat is not available. Please refresh the page and try again.');
      return;
    }
    
    if (!socket || !socket.connected) {
      alert('Not connected to server. Please wait for connection and try again.');
      return;
    }

    if (!audioEnabled) {
      try {
        setConnectionStatus('connecting');
        
        // Request media with video if private room
        const mediaConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
          }
        };
        
        // Add video for private rooms
        if (isPrivateRoom) {
          mediaConstraints.video = {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          };
        }
        
        const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        
        // Separate audio and video streams
        const audioTracks = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();
        
        // Store the combined stream (includes both audio and video tracks)
        if (audioTracks.length > 0) {
          setAudioStream(stream);
          setAudioEnabled(true);
        }
        
        if (videoTracks.length > 0 && isPrivateRoom) {
          setVideoStream(stream); // Same stream object, includes both tracks
          setVideoEnabled(true);
          // Display local video
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        }
        
        // Note: The stream passed to peers will include both audio and video tracks
        // when video is enabled, since it's the same MediaStream object
        
        setConnectionStatus('connected');
        
        // Notify server that we're joining voice chat
        console.log('📞 Joining voice chat', { roomId, socketId: socket.id });
        if (socket && socket.connected) {
          socket.emit('join_voice_chat', { roomId });
        } else {
          console.error('❌ Cannot join voice chat - socket not connected');
          setConnectionStatus('error');
          stream.getTracks().forEach(track => track.stop());
          setAudioStream(null);
          setAudioEnabled(false);
          return;
        }
        
        // Note: We don't create peers here for existing users
        // The server will notify existing voice chat users via 'new_user_joined_voice'
        // and they will create peers to connect to us
        // We will receive 'user_joined_voice' events for users already in voice chat
        // and create peers to connect to them
        console.log('Joined voice chat, waiting for peer connections...');
        
      } catch (err) {
        console.error('Failed to get audio stream:', err);
        setConnectionStatus('error');
        
        let errorMessage = 'Failed to access microphone. ';
        
        // Check if site is using HTTP (not secure)
        const isHttp = window.location.protocol === 'http:';
        
        if (isHttp) {
          errorMessage += 'Microphone access requires HTTPS. Please use https://watch.cloudpillers.com instead of http://';
        } else if (err.name === 'NotAllowedError') {
          errorMessage += 'Please allow microphone access in your browser settings and try again.';
        } else if (err.name === 'NotFoundError') {
          errorMessage += 'No microphone found. Please connect a microphone and try again.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          errorMessage += 'Microphone is being used by another application. Please close other apps using the microphone and try again.';
        } else if (err.name === 'OverconstrainedError') {
          errorMessage += 'Microphone does not support required settings. Please try a different microphone.';
        } else {
          errorMessage += `Error: ${err.message || err.name}. Please check your microphone settings and try again.`;
        }
        
        alert(errorMessage);
      }
    } else {
      // Stop voice chat - cleanup in proper order
      try {
        // Notify server first that we're leaving voice chat
        if (socket && socket.connected) {
          socket.emit('leave_voice_chat', { roomId });
        }
        
        // Stop video stream if enabled
        if (videoStream) {
          videoStream.getTracks().forEach(track => {
            try {
              track.stop();
            } catch (e) {
              console.warn('Error stopping video track:', e);
            }
          });
          setVideoStream(null);
          setVideoEnabled(false);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
          }
        }
        
        // First, remove all event listeners from peers
        peersRef.current.forEach(peerObj => {
          try {
            if (peerObj.peer) {
              // Remove all event listeners
              peerObj.peer.removeAllListeners();
              // Destroy peer connection
              if (typeof peerObj.peer.destroy === 'function') {
                peerObj.peer.destroy();
              }
            }
          } catch (e) {
            console.warn('Error cleaning up peer:', e);
          }
        });
        
        // Clear peer references
        peersRef.current = [];
        
        // Clear all retry timers
        Object.values(peerRetryTimers.current).forEach(timer => clearTimeout(timer));
        peerRetryTimers.current = {};
        
        // Clear all connection timeouts
        Object.values(peerConnectionTimeouts.current).forEach(timer => clearTimeout(timer));
        peerConnectionTimeouts.current = {};
        
        // Clear all peer volumes
        peerVolumeRefs.current = {};
        setPeerVolumes({});
        
        // Stop audio stream tracks
        if (audioStream) {
          audioStream.getTracks().forEach(track => {
            try {
              track.stop();
            } catch (e) {
              console.warn('Error stopping track:', e);
            }
          });
        }
        
        // Remove all audio elements
        document.querySelectorAll('#audio-container audio').forEach(audio => {
          try {
            if (audio.srcObject) {
              audio.srcObject.getTracks().forEach(track => track.stop());
            }
            audio.remove();
          } catch (e) {
            console.warn('Error removing audio element:', e);
          }
        });
        
        // Reset state
        setAudioStream(null);
        setAudioEnabled(false);
        setConnectionStatus('disconnected');
      } catch (error) {
        console.error('Error stopping voice chat:', error);
        // Force reset state even if cleanup fails
        setAudioStream(null);
        setAudioEnabled(false);
        setConnectionStatus('disconnected');
        peersRef.current = [];
      }
    }
  };

  // Create a new peer connection (caller)
  const createPeer = useCallback((userToSignal, callerID, stream) => {
    if (!Peer) return null;

    try {
      const peer = new Peer({
        initiator: true,
        trickle: true, // Enable trickle ICE for faster connection
        stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ]
        }
      });

      // Set up event handlers directly
      peer.on('signal', signal => {
        try {
          console.log('Sending signal to:', userToSignal);
        socket.emit('sending_signal', { 
          userToSignal, 
          callerID, 
          signal 
        });
        } catch (err) {
          console.error('Error emitting signal:', err);
        }
      });

      peer.on('error', err => {
        console.error('Peer error:', err);
        // Retry connection on error (with delay)
        if (!peerRetryTimers.current[userToSignal] && audioStream && socket) {
          console.log('🔄 Scheduling retry for peer:', userToSignal);
          peerRetryTimers.current[userToSignal] = setTimeout(() => {
            delete peerRetryTimers.current[userToSignal];
            console.log('🔄 Retrying peer connection for:', userToSignal);
            const retryPeer = createPeer(userToSignal, socket.id, audioStream);
            if (retryPeer) {
              const peerObj = { peerID: userToSignal, peer: retryPeer };
              const existingIndex = peersRef.current.findIndex(p => p.peerID === userToSignal);
              if (existingIndex >= 0) {
                try {
                  if (peersRef.current[existingIndex].peer) {
                    peersRef.current[existingIndex].peer.destroy();
                  }
                } catch (e) {}
                peersRef.current[existingIndex] = peerObj;
              } else {
                peersRef.current.push(peerObj);
              }
              // Peer state managed via peersRef
            }
          }, 3000);
        }
      });

      peer.on('connect', () => {
        console.log('✅ Peer connected:', userToSignal);
        // Clear any retry timers for this peer
        if (peerRetryTimers.current[userToSignal]) {
          clearTimeout(peerRetryTimers.current[userToSignal]);
          delete peerRetryTimers.current[userToSignal];
        }
        // Clear connection timeout
        if (peerConnectionTimeouts.current[userToSignal]) {
          clearTimeout(peerConnectionTimeouts.current[userToSignal]);
          delete peerConnectionTimeouts.current[userToSignal];
        }
      });
      
      // Add connection timeout (30 seconds)
      peerConnectionTimeouts.current[userToSignal] = setTimeout(() => {
        if (peer && !peer.connected) {
          console.warn('⚠️ Peer connection timeout for:', userToSignal);
          try {
            peer.destroy();
          } catch (e) {
            console.warn('Error destroying timed-out peer:', e);
          }
          // Retry connection
          if (audioStream && socket) {
            console.log('🔄 Retrying peer connection for:', userToSignal);
            setTimeout(() => {
              const retryPeer = createPeer(userToSignal, socket.id, audioStream);
              if (retryPeer) {
                const peerObj = { peerID: userToSignal, peer: retryPeer };
                const existingIndex = peersRef.current.findIndex(p => p.peerID === userToSignal);
                if (existingIndex >= 0) {
                  peersRef.current[existingIndex] = peerObj;
                } else {
                  peersRef.current.push(peerObj);
                }
                // Peer state managed via peersRef
              }
            }, 2000);
          }
        }
      }, 30000);

      // Handle incoming stream from peer - THIS IS CRITICAL
      peer.on('stream', (remoteStream) => {
        try {
          console.log('🎵 Received stream from peer:', userToSignal, remoteStream);
          console.log('Stream tracks:', remoteStream.getTracks().length);
          
          // Separate audio and video tracks
          const audioTracks = remoteStream.getAudioTracks();
          const videoTracks = remoteStream.getVideoTracks();
          
          // Handle audio
          if (audioTracks.length > 0) {
            // Remove existing audio element for this peer
            const existingAudio = document.querySelector(`audio[data-peer-id="${userToSignal}"]`);
            if (existingAudio) {
              try {
                if (existingAudio.srcObject) {
                  existingAudio.srcObject.getTracks().forEach(track => track.stop());
                }
                existingAudio.remove();
              } catch (e) {
                console.warn('Error removing existing audio:', e);
              }
            }

            // Create an audio element for this peer
            const audio = document.createElement('audio');
            audio.srcObject = new MediaStream(audioTracks);
            audio.autoplay = true;
            audio.playsInline = true;
            // Get volume for this specific peer (default 100)
            const peerVolume = peerVolumeRefs.current[userToSignal] || 100;
            audio.volume = peerVolume / 100;
            audio.setAttribute('data-peer-id', userToSignal);
            
            // Ensure audio container exists
            let audioContainer = document.getElementById('audio-container');
            if (!audioContainer) {
              audioContainer = document.createElement('div');
              audioContainer.id = 'audio-container';
              audioContainer.style.display = 'none';
              document.body.appendChild(audioContainer);
            }
            
            audioContainer.appendChild(audio);
            
            // Play the audio
            const playPromise = audio.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  console.log('✅ Audio playing for peer:', userToSignal);
                })
                .catch(err => {
                  console.error('❌ Error playing audio for peer:', userToSignal, err);
                });
            }
          }
          
          // Handle video (for private rooms)
          if (videoTracks.length > 0 && isPrivateRoom) {
            console.log('📹 Received video stream from peer:', userToSignal, 'Video tracks:', videoTracks.length);
            // Store video stream in state
            const videoStream = new MediaStream(videoTracks);
            setPeerVideoStreams(prev => {
              const updated = { ...prev, [userToSignal]: videoStream };
              console.log('📹 Updated peerVideoStreams:', Object.keys(updated));
              return updated;
            });
          }
        } catch (err) {
          console.error('Error handling stream:', err);
        }
      });

      return peer;
    } catch (error) {
      console.error('Error creating peer:', error);
      // Return null instead of throwing
      return null;
    }
  }, [socket, audioStream]);

  // Add a peer connection (receiver)
  const addPeer = useCallback((incomingSignal, callerID, stream) => {
    if (!Peer) return null;

    try {
      const peer = new Peer({
        initiator: false,
        trickle: true, // Enable trickle ICE for faster connection
        stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ]
        }
      });

      // Set up event handlers directly
      peer.on('signal', signal => {
        try {
          console.log('Sending return signal to:', callerID);
        socket.emit('returning_signal', { 
          signal, 
          callerID 
        });
        } catch (err) {
          console.error('Error emitting return signal:', err);
        }
      });

      peer.on('error', err => {
        console.error('Peer error:', err);
        // Retry connection on error (with delay)
        if (!peerRetryTimers.current[callerID] && audioStream && socket) {
          console.log('🔄 Scheduling retry for peer:', callerID);
          peerRetryTimers.current[callerID] = setTimeout(() => {
            delete peerRetryTimers.current[callerID];
            console.log('🔄 Retrying peer connection for:', callerID);
            // Re-request signal from server or recreate peer
            socket.emit('request_voice_signal', { userId: callerID, roomId });
          }, 3000);
        }
      });

      peer.on('connect', () => {
        console.log('✅ Peer connected:', callerID);
        // Clear any retry timers for this peer
        if (peerRetryTimers.current[callerID]) {
          clearTimeout(peerRetryTimers.current[callerID]);
          delete peerRetryTimers.current[callerID];
        }
        // Clear connection timeout
        if (peerConnectionTimeouts.current[callerID]) {
          clearTimeout(peerConnectionTimeouts.current[callerID]);
          delete peerConnectionTimeouts.current[callerID];
        }
      });
      
      // Add connection timeout (30 seconds)
      peerConnectionTimeouts.current[callerID] = setTimeout(() => {
        if (peer && !peer.connected) {
          console.warn('⚠️ Peer connection timeout for:', callerID);
          try {
            peer.destroy();
          } catch (e) {
            console.warn('Error destroying timed-out peer:', e);
          }
        }
      }, 30000);

      // Handle incoming stream from peer - THIS IS CRITICAL
      peer.on('stream', (remoteStream) => {
        try {
          console.log('🎵 Received stream from peer:', callerID, remoteStream);
          console.log('Stream tracks:', remoteStream.getTracks().length);
          
          // Separate audio and video tracks
          const audioTracks = remoteStream.getAudioTracks();
          const videoTracks = remoteStream.getVideoTracks();
          
          // Handle audio
          if (audioTracks.length > 0) {
            // Remove existing audio element for this peer
            const existingAudio = document.querySelector(`audio[data-peer-id="${callerID}"]`);
            if (existingAudio) {
              try {
                if (existingAudio.srcObject) {
                  existingAudio.srcObject.getTracks().forEach(track => track.stop());
                }
                existingAudio.remove();
              } catch (e) {
                console.warn('Error removing existing audio:', e);
              }
            }

            // Create an audio element for this peer
            const audio = document.createElement('audio');
            audio.srcObject = new MediaStream(audioTracks);
            audio.autoplay = true;
            audio.playsInline = true;
            // Get volume for this specific peer (default 100)
            const peerVolume = peerVolumeRefs.current[callerID] || 100;
            audio.volume = peerVolume / 100;
            audio.setAttribute('data-peer-id', callerID);
            
            // Ensure audio container exists
            let audioContainer = document.getElementById('audio-container');
            if (!audioContainer) {
              audioContainer = document.createElement('div');
              audioContainer.id = 'audio-container';
              audioContainer.style.display = 'none';
              document.body.appendChild(audioContainer);
            }
            
            audioContainer.appendChild(audio);
            
            // Play the audio
            const playPromise = audio.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  console.log('✅ Audio playing for peer:', callerID);
                })
                .catch(err => {
                  console.error('❌ Error playing audio for peer:', callerID, err);
                });
            }
          }
          
          // Handle video (for private rooms)
          if (videoTracks.length > 0 && isPrivateRoom) {
            console.log('📹 Received video stream from peer:', callerID, 'Video tracks:', videoTracks.length);
            // Store video stream in state
            const videoStream = new MediaStream(videoTracks);
            setPeerVideoStreams(prev => {
              const updated = { ...prev, [callerID]: videoStream };
              console.log('📹 Updated peerVideoStreams:', Object.keys(updated));
              return updated;
            });
          }
        } catch (err) {
          console.error('Error handling stream:', err);
        }
      });

      // Signal the peer AFTER all handlers are set up
      try {
        console.log('Signaling peer with incoming signal:', callerID);
        peer.signal(incomingSignal);
      } catch (err) {
        console.error('Error signaling peer:', err);
        return null;
      }

      return peer;
    } catch (error) {
      console.error('Error adding peer:', error);
      // Return null instead of throwing
      return null;
    }
  }, [socket, audioStream, roomId]);

  // Handle incoming voice chat connections
  useEffect(() => {
    if (!socket || !socket.connected) {
      console.warn('⚠️ Socket not connected, cannot set up voice chat events');
      return;
    }
    
    if (!peerLoaded) {
      console.warn('⚠️ Peer library not loaded, cannot set up voice chat events');
      return;
    }
    
    console.log('✅ Setting up voice chat socket events', { socketId: socket.id, roomId });

    // When a new user joins voice chat and we need to connect to them
    // This event is sent when someone who is already in voice chat wants to connect to us
    socket.on('user_joined_voice', payload => {
      console.log('📞 User joined voice chat, received signal:', payload.callerID);
      if (audioStream && payload.signal) {
        // Check if peer already exists
        const existingPeer = peersRef.current.find(p => p.peerID === payload.callerID);
        if (existingPeer) {
          console.log('⚠️ Peer already exists for:', payload.callerID);
          return;
        }
        
        const peer = addPeer(payload.signal, payload.callerID, audioStream);
        
        if (peer) {
          const peerObj = {
            peerID: payload.callerID,
            peer
          };
          
          peersRef.current.push(peerObj);
          // Peer state managed via peersRef
          // Initialize volume for this peer
          if (peerVolumeRefs.current[payload.callerID] === undefined) {
            peerVolumeRefs.current[payload.callerID] = 100;
            setPeerVolumes(prev => ({ ...prev, [payload.callerID]: 100 }));
          }
          console.log('✅ Added peer for:', payload.callerID);
        } else {
          console.error('❌ Failed to create peer for:', payload.callerID);
        }
      } else {
        console.warn('⚠️ No audio stream or signal received for:', payload.callerID);
      }
    });
    
    // When a new user joins voice chat and we need to send them our signal
    // This event is sent when a new user joins voice chat and we need to connect to them
    socket.on('new_user_joined_voice', payload => {
      console.log('🆕 New user joined voice chat, creating peer:', payload.userId);
      if (audioStream && payload.userId !== socket.id) {
        // Check if peer already exists
        const existingPeer = peersRef.current.find(p => p.peerID === payload.userId);
        if (existingPeer) {
          console.log('⚠️ Peer already exists for:', payload.userId);
          return;
        }
        
        const peer = createPeer(payload.userId, socket.id, audioStream);
        if (peer) {
          const peerObj = {
            peerID: payload.userId,
            peer
          };
          peersRef.current.push(peerObj);
          // Peer state managed via peersRef
          // Initialize volume for this peer
          if (peerVolumeRefs.current[payload.userId] === undefined) {
            peerVolumeRefs.current[payload.userId] = 100;
            setPeerVolumes(prev => ({ ...prev, [payload.userId]: 100 }));
          }
          console.log('✅ Created peer for:', payload.userId);
        } else {
          console.error('❌ Failed to create peer for:', payload.userId);
        }
      } else {
        console.warn('⚠️ No audio stream or invalid userId:', payload.userId);
      }
    });

    // Receiving the returned signal from a peer
    socket.on('receiving_returned_signal', payload => {
      const item = peersRef.current.find(p => p.peerID === payload.id);
      if (item) {
        try {
          item.peer.signal(payload.signal);
        } catch (error) {
          console.error('Error signaling peer:', error);
        }
      } else {
        console.warn('⚠️ Received signal for unknown peer:', payload.id);
      }
    });

    // Handle retry request from another user
    socket.on('retry_voice_connection', payload => {
      console.log('🔄 Retry requested by:', payload.requestingUserId);
      if (audioStream && payload.requestingUserId !== socket.id) {
        // Check if peer already exists
        const existingPeer = peersRef.current.find(p => p.peerID === payload.requestingUserId);
        if (existingPeer) {
          console.log('⚠️ Peer already exists, destroying and recreating:', payload.requestingUserId);
          try {
            if (existingPeer.peer) {
              existingPeer.peer.destroy();
            }
          } catch (e) {}
          // Remove from peers
          peersRef.current = peersRef.current.filter(p => p.peerID !== payload.requestingUserId);
          // Peer state managed via peersRef
        }
        
        // Create new peer connection
        const peer = createPeer(payload.requestingUserId, socket.id, audioStream);
        if (peer) {
          const peerObj = { peerID: payload.requestingUserId, peer };
          peersRef.current.push(peerObj);
          // Peer state managed via peersRef
          // Initialize volume for this peer if not already set
          if (peerVolumeRefs.current[payload.requestingUserId] === undefined) {
            peerVolumeRefs.current[payload.requestingUserId] = 100;
            setPeerVolumes(prev => ({ ...prev, [payload.requestingUserId]: 100 }));
          }
          console.log('✅ Recreated peer for retry:', payload.requestingUserId);
        }
      }
    });

    // When a user leaves voice chat
    socket.on('user_left_voice', payload => {
      console.log('👋 User left voice chat:', payload.userId);
      const peerObj = peersRef.current.find(p => p.peerID === payload.userId);
      if (peerObj) {
        try {
          if (peerObj.peer) {
            // Remove all event listeners
            peerObj.peer.removeAllListeners();
            // Destroy peer connection
            if (typeof peerObj.peer.destroy === 'function') {
              peerObj.peer.destroy();
            }
          }
        } catch (error) {
          console.warn('Error destroying peer on user leave voice:', error);
        }
      }
      
      // Remove peer from list
      peersRef.current = peersRef.current.filter(p => p.peerID !== payload.userId);
      
      // Remove audio element for this peer
      const audioElement = document.querySelector(`audio[data-peer-id="${payload.userId}"]`);
      if (audioElement) {
        try {
          if (audioElement.srcObject) {
            audioElement.srcObject.getTracks().forEach(track => track.stop());
          }
          audioElement.remove();
        } catch (e) {
          console.warn('Error removing audio element:', e);
        }
      }
      
      // Clean up volume settings for this peer
      delete peerVolumeRefs.current[payload.userId];
      setPeerVolumes(prev => {
        const updated = { ...prev };
        delete updated[payload.userId];
        return updated;
      });
      
      // Remove video stream for this peer
      setPeerVideoStreams(prev => {
        const updated = { ...prev };
        delete updated[payload.userId];
        console.log(`📹 Removed video stream for peer: ${payload.userId}`);
        return updated;
      });
      
      // Clean up video element
      const videoElement = videoRefs.current[payload.userId];
      if (videoElement) {
        try {
          if (videoElement.srcObject) {
            videoElement.srcObject.getTracks().forEach(track => track.stop());
          }
          videoElement.srcObject = null;
        } catch (e) {
          console.warn('Error cleaning up video element:', e);
        }
        delete videoRefs.current[payload.userId];
      }
      
      // Notify parent component about peer mute status change
      if (onPeerMuteChange) {
        onPeerMuteChange(payload.userId, undefined);
      }
    });

    // When a user leaves the room entirely
    socket.on('user_left', payload => {
      console.log('👋 User left room:', payload.userId);
      const peerObj = peersRef.current.find(p => p.peerID === payload.userId);
      if (peerObj) {
        try {
          if (peerObj.peer) {
            // Remove all event listeners
            peerObj.peer.removeAllListeners();
            // Destroy peer connection
            if (typeof peerObj.peer.destroy === 'function') {
              peerObj.peer.destroy();
            }
          }
        } catch (error) {
          console.warn('Error destroying peer on user leave:', error);
        }
      }
      
      peersRef.current = peersRef.current.filter(p => p.peerID !== payload.userId);
      
      // Remove audio element for this peer
      const audioElement = document.querySelector(`audio[data-peer-id="${payload.userId}"]`);
      if (audioElement) {
        try {
          if (audioElement.srcObject) {
            audioElement.srcObject.getTracks().forEach(track => track.stop());
          }
          audioElement.remove();
        } catch (e) {
          console.warn('Error removing audio element:', e);
        }
      }
      
      // Clean up volume settings for this peer
      delete peerVolumeRefs.current[payload.userId];
      setPeerVolumes(prev => {
        const updated = { ...prev };
        delete updated[payload.userId];
        return updated;
      });
    });

    return () => {
      socket.off('user_joined_voice');
      socket.off('receiving_returned_signal');
      socket.off('user_left');
      socket.off('user_left_voice');
      socket.off('new_user_joined_voice');
      socket.off('retry_voice_connection');
    };
  }, [socket, audioStream, peerLoaded, addPeer, createPeer, roomId, onPeerMuteChange]);

  // Handle mute/unmute
  const toggleMute = () => {
    if (audioStream) {
      const audioTrack = audioStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicMuted(!audioTrack.enabled);
      }
    }
  };

  // Handle video toggle (for private rooms)
  const toggleVideo = () => {
    if (!isPrivateRoom) return;
    
    if (videoStream) {
      const videoTrack = videoStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoMuted(!videoTrack.enabled);
      }
    }
  };

  // Resize handlers
  const handleResizeStart = (e, target) => {
    e.preventDefault();
    setIsResizing(true);
    setResizeTarget(target);
    
    const container = videoContainerRefs.current[target];
    if (container) {
      const rect = container.getBoundingClientRect();
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: rect.width,
        height: rect.height
      });
    }
  };

  const handleResizeMove = useCallback((e) => {
    if (!isResizing || !resizeTarget) return;
    
    const deltaX = e.clientX - resizeStart.x;
    const deltaY = e.clientY - resizeStart.y;
    
    const newWidth = Math.max(150, Math.min(800, resizeStart.width + deltaX));
    const newHeight = Math.max(100, Math.min(600, resizeStart.height + deltaY));
    
    setVideoSizes(prev => ({
      ...prev,
      [resizeTarget]: { width: newWidth, height: newHeight }
    }));
  }, [isResizing, resizeTarget, resizeStart]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeTarget(null);
  }, []);

  // Drag handlers - optimized to prevent flickering
  const handleDragStart = (e, target) => {
    // Don't start drag if clicking on resize handle
    if (e.target.closest('.resize-handle')) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const container = videoContainerRefs.current[target];
    if (!container) return;
    
    // Update cursor immediately via DOM to avoid re-render
    container.style.cursor = 'grabbing';
    
    const rect = container.getBoundingClientRect();
    const currentPos = videoPositions[target];
    
    // If already positioned, use that position; otherwise use current rect position
    const startX = currentPos ? currentPos.x : rect.left;
    const startY = currentPos ? currentPos.y : rect.top;
    
    // Set refs immediately (no state update = no re-render)
    isDraggingRef.current = true;
    dragTargetRef.current = target;
    
    // Set state for UI updates (isDragging, dragTarget) - this will cause one re-render
    setIsDragging(true);
    setDragTarget(target);
    
    // Set initial position if not already set (switch to fixed positioning)
    if (!currentPos) {
      // Update DOM directly first
      container.style.position = 'fixed';
      container.style.left = `${rect.left}px`;
      container.style.top = `${rect.top}px`;
      
      // Then update state (will cause re-render but position is already set)
      setVideoPositions(prev => ({
        ...prev,
        [target]: { x: rect.left, y: rect.top }
      }));
    }
    
    // Calculate offset from mouse to element's top-left corner - store in ref
    dragStartRef.current = {
      x: e.clientX - startX,
      y: e.clientY - startY
    };
    
    // Also update state for initial render (only happens once)
    setDragStart(dragStartRef.current);
  };

  const handleDragMove = useCallback((e) => {
    // Use refs to check dragging state (no re-render trigger)
    if (!isDraggingRef.current || !dragTargetRef.current) return;
    
    e.preventDefault();
    
    const target = dragTargetRef.current;
    const container = videoContainerRefs.current[target];
    if (!container) return;
    
    // Use ref for drag start (no state dependency)
    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;
    
    // Constrain to viewport
    const width = videoSizes[target]?.width || 200;
    const height = videoSizes[target]?.height || 150;
    const maxX = window.innerWidth - width;
    const maxY = window.innerHeight - height;
    
    const constrainedX = Math.max(0, Math.min(maxX, newX));
    const constrainedY = Math.max(0, Math.min(maxY, newY));
    
    // Update ref for final position
    dragPositionRef.current = { x: constrainedX, y: constrainedY };
    
    // Update DOM directly - NO state update during drag (prevents flickering)
    container.style.left = `${constrainedX}px`;
    container.style.top = `${constrainedY}px`;
    container.style.transform = 'translateZ(0)'; // Force GPU acceleration
  }, [videoSizes]);

  const handleDragEnd = useCallback(() => {
    const target = dragTargetRef.current;
    
    if (target) {
      const container = videoContainerRefs.current[target];
      if (container) {
        // Reset cursor via DOM to avoid re-render
        container.style.cursor = 'grab';
        container.style.transform = ''; // Remove transform
      }
      
      // Update refs first
      isDraggingRef.current = false;
      dragTargetRef.current = null;
      
      // Now update state (will cause re-render but drag is done)
      setVideoPositions(prev => ({
        ...prev,
        [target]: dragPositionRef.current
      }));
    }
    
    // Update state for UI
    setIsDragging(false);
    setDragTarget(null);
  }, []);

  // Add global mouse event listeners for resizing and dragging
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);


  // Handle volume change for a specific peer - used by App.js Participants section
  const handlePeerVolumeChange = (peerId, newVolume) => {
    setPeerVolumes(prev => ({
      ...prev,
      [peerId]: newVolume
    }));
    peerVolumeRefs.current[peerId] = newVolume;
    
    // Apply volume to this specific peer's audio element
    const audio = document.querySelector(`audio[data-peer-id="${peerId}"]`);
    if (audio) {
      audio.volume = newVolume / 100;
    }
  };
  
  // Expose handlePeerVolumeChange for use in App.js Participants section
  useEffect(() => {
    if (onPeerVolumesChange) {
      onPeerVolumesChange(handlePeerVolumeChange);
    }
  }, [onPeerVolumesChange]);

  // Update local video when stream is available
  useEffect(() => {
    if (videoStream && localVideoRef.current) {
      localVideoRef.current.srcObject = videoStream;
      console.log('📹 Local video stream assigned to video element');
      
      // Ensure video plays
      const playPromise = localVideoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('✅ Local video playing');
          })
          .catch(err => {
            console.error('❌ Error playing local video:', err);
          });
      }
    } else if (localVideoRef.current && !videoStream) {
      localVideoRef.current.srcObject = null;
    }
  }, [videoStream, videoMuted]);

  // Update remote video elements when streams are received
  useEffect(() => {
    Object.entries(peerVideoStreams).forEach(([peerId, stream]) => {
      const videoElement = videoRefs.current[peerId];
      if (videoElement && stream) {
        console.log(`📹 Assigning video stream to element for peer: ${peerId}`);
        videoElement.srcObject = stream;
        
        // Ensure video plays
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log(`✅ Remote video playing for peer: ${peerId}`);
            })
            .catch(err => {
              console.error(`❌ Error playing remote video for peer ${peerId}:`, err);
            });
        }
      }
    });
  }, [peerVideoStreams]);

  // Update volume for all audio elements when volume changes
  useEffect(() => {
    document.querySelectorAll('#audio-container audio').forEach(audio => {
      const peerId = audio.getAttribute('data-peer-id');
      if (peerId && peerVolumeRefs.current[peerId] !== undefined) {
        // Use individual volume if set
        audio.volume = peerVolumeRefs.current[peerId] / 100;
      } else {
        // Use global volume
        audio.volume = volume / 100;
      }
    });
  }, [volume, peerVolumes]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Cleanup all peers when component unmounts
      peersRef.current.forEach(peerObj => {
        try {
          if (peerObj.peer) {
            peerObj.peer.removeAllListeners();
            if (typeof peerObj.peer.destroy === 'function') {
              peerObj.peer.destroy();
            }
          }
        } catch (e) {
          console.warn('Error cleaning up peer on unmount:', e);
        }
      });
      
      // Stop audio stream
      if (audioStream) {
        audioStream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (e) {
            console.warn('Error stopping track on unmount:', e);
          }
        });
      }
      
      // Remove all audio elements
      document.querySelectorAll('#audio-container audio').forEach(audio => {
        try {
          if (audio.srcObject) {
            audio.srcObject.getTracks().forEach(track => track.stop());
          }
        audio.remove();
        } catch (e) {
          console.warn('Error removing audio on unmount:', e);
        }
      });
    };
  }, [audioStream]);


  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return '🟢';
      case 'connecting': return '🟡';
      case 'error': return '🔴';
      default: return '⚪';
    }
  };

  const getStatusText = () => {
    if (!peerLoaded) return 'Loading...';
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Error';
      default: return 'Disconnected';
    }
  };

  const cardStyle = noCard ? {} : { className: 'component-card' };

  return (
    <div {...cardStyle} style={{
      marginBottom: 0,
      ...(noCard ? {
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        padding: '20px'
      } : {})
    }}>
      {!noCard && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>
            {isPrivateRoom ? '🎥 Voice + Video Chat' : '🎤 Voice Chat'}
          </h3>
          <span style={{
            padding: '6px 14px',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            border: '1px solid var(--border-color)'
          }}>
            {getStatusIcon()} {getStatusText()}
          </span>
        </div>
      )}
      
      {!peerLoaded && (
        <div style={{
          background: 'linear-gradient(135deg, #ffc107, #ff9800)',
          color: '#212529',
          padding: '14px 18px',
          borderRadius: '12px',
          marginBottom: '20px',
          boxShadow: 'var(--shadow-md)',
          borderLeft: '4px solid #ffd700',
          fontWeight: '500',
          fontSize: '14px'
        }}>
          ⏳ Loading voice chat components...
        </div>
      )}
      
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        alignItems: 'center', 
        marginBottom: '20px', 
        flexWrap: 'wrap' 
      }}>
        <button
          onClick={toggleVoiceChat}
          className={audioEnabled ? 'btn-danger' : 'btn-success'}
          style={{ 
            minWidth: '160px',
            padding: '12px 20px',
            fontSize: '15px',
            fontWeight: '700'
          }}
          disabled={!peerLoaded}
        >
          {audioEnabled ? '🔴 Leave Voice' : '🎤 Join Voice'}
        </button>

        {audioEnabled && (
          <>
            <button
              onClick={toggleMute}
              style={{
                background: micMuted 
                  ? 'linear-gradient(135deg, #ffc107, #ff9800)' 
                  : 'linear-gradient(135deg, #17a2b8, #138496)',
                color: micMuted ? '#212529' : 'white',
                minWidth: '160px',
                padding: '12px 20px',
                fontSize: '15px',
                fontWeight: '700',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
              }}
            >
              {micMuted ? '🔇 Unmute' : '🔊 Mute'}
            </button>
            
            {isPrivateRoom && videoEnabled && (
              <button
                onClick={toggleVideo}
                style={{
                  background: videoMuted 
                    ? 'linear-gradient(135deg, #ffc107, #ff9800)' 
                    : 'linear-gradient(135deg, #9333ea, #7e22ce)',
                  color: videoMuted ? '#212529' : 'white',
                  minWidth: '160px',
                  padding: '12px 20px',
                  fontSize: '15px',
                  fontWeight: '700',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
                }}
              >
                {videoMuted ? '📹 Show Video' : '📹 Hide Video'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Video Grid for Private Rooms */}
      {isPrivateRoom && videoEnabled && (
        <div style={{
          marginTop: '20px',
          marginBottom: '20px',
          position: 'relative',
          minHeight: '200px'
        }}>
          <h4 style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--text-secondary)'
          }}>
            Video Chat
          </h4>
          
          {/* Local Video */}
          {videoStream && (
            <div 
              ref={(el) => { if (el) videoContainerRefs.current['local'] = el; }}
              onMouseDown={(e) => handleDragStart(e, 'local')}
              className={isDragging && dragTarget === 'local' ? 'dragging' : ''}
              style={{
                marginBottom: videoPositions['local'] ? '0' : '12px',
                borderRadius: '8px',
                overflow: 'hidden',
                background: '#000',
                position: videoPositions['local'] ? 'fixed' : 'relative',
                cursor: isResizing && resizeTarget === 'local' ? 'nwse-resize' : 'grab',
                width: videoSizes['local']?.width || '200px',
                height: videoSizes['local']?.height || '150px',
                minWidth: '150px',
                minHeight: '100px',
                maxWidth: '800px',
                maxHeight: '600px',
                opacity: videoMuted ? 0.3 : 1,
                left: (isDraggingRef.current && dragTargetRef.current === 'local') 
                  ? undefined // Let DOM handle it during drag
                  : (videoPositions['local'] ? `${videoPositions['local'].x}px` : 'auto'),
                top: (isDraggingRef.current && dragTargetRef.current === 'local')
                  ? undefined // Let DOM handle it during drag
                  : (videoPositions['local'] ? `${videoPositions['local'].y}px` : 'auto'),
                zIndex: (isDragging && dragTarget === 'local') ? 1000 : (videoPositions['local'] ? 100 : 10),
                boxShadow: videoPositions['local'] ? '0 4px 20px rgba(0, 0, 0, 0.3)' : 'none',
                userSelect: 'none',
                willChange: isDragging && dragTarget === 'local' ? 'transform' : 'auto',
                transition: isDragging && dragTarget === 'local' ? 'none' : 'box-shadow 0.2s ease',
                pointerEvents: 'auto',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none'
              }}
              onMouseEnter={(e) => {
                if (!isDraggingRef.current && !isResizing) {
                  e.currentTarget.style.cursor = 'grab';
                }
              }}
              onMouseLeave={(e) => {
                if (!isDraggingRef.current && !isResizing) {
                  e.currentTarget.style.cursor = 'default';
                }
              }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  objectFit: 'cover',
                  pointerEvents: 'none',
                  userSelect: 'none'
                }}
              />
              <div style={{
                position: 'absolute',
                bottom: '8px',
                left: '8px',
                background: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                You
              </div>
              {/* Resize Handle */}
              <div
                className="resize-handle"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleResizeStart(e, 'local');
                }}
                style={{
                  position: 'absolute',
                  bottom: '0',
                  right: '0',
                  width: '20px',
                  height: '20px',
                  background: 'rgba(99, 102, 241, 0.8)',
                  cursor: 'nwse-resize',
                  borderTopLeftRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 11
                }}
              >
                <div style={{
                  width: '0',
                  height: '0',
                  borderLeft: '8px solid transparent',
                  borderBottom: '8px solid white',
                  transform: 'rotate(45deg)',
                  marginBottom: '2px',
                  marginRight: '2px'
                }}></div>
              </div>
            </div>
          )}
          
          {/* Remote Video Streams */}
          {Object.entries(peerVideoStreams).map(([peerId, stream]) => {
            // Try to find user by userId or socketId
            const user = users.find(u => u.userId === peerId || u.socketId === peerId) || 
                        users.find(u => u.userId?.includes(peerId) || peerId?.includes(u.userId)) ||
                        { username: 'User' };
            console.log(`📹 Rendering video for peerId: ${peerId}, user:`, user);
            return (
              <div
                key={peerId}
                ref={(el) => { if (el) videoContainerRefs.current[peerId] = el; }}
                onMouseDown={(e) => handleDragStart(e, peerId)}
                className={isDragging && dragTarget === peerId ? 'dragging' : ''}
                style={{
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#000',
                  position: videoPositions[peerId] ? 'fixed' : 'relative',
                  cursor: isResizing && resizeTarget === peerId ? 'nwse-resize' : 'grab',
                  width: videoSizes[peerId]?.width || '200px',
                  height: videoSizes[peerId]?.height || '150px',
                  minWidth: '150px',
                  minHeight: '100px',
                  maxWidth: '800px',
                  maxHeight: '600px',
                  left: (isDraggingRef.current && dragTargetRef.current === peerId)
                    ? undefined // Let DOM handle it during drag
                    : (videoPositions[peerId] ? `${videoPositions[peerId].x}px` : 'auto'),
                  top: (isDraggingRef.current && dragTargetRef.current === peerId)
                    ? undefined // Let DOM handle it during drag
                    : (videoPositions[peerId] ? `${videoPositions[peerId].y}px` : 'auto'),
                  zIndex: (isDragging && dragTarget === peerId) ? 1000 : (videoPositions[peerId] ? 100 : 10),
                  boxShadow: videoPositions[peerId] ? '0 4px 20px rgba(0, 0, 0, 0.3)' : 'none',
                  userSelect: 'none',
                  marginBottom: videoPositions[peerId] ? '0' : '12px',
                  willChange: isDragging && dragTarget === peerId ? 'transform' : 'auto',
                  transition: isDragging && dragTarget === peerId ? 'none' : 'box-shadow 0.2s ease',
                  pointerEvents: 'auto',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isDraggingRef.current && !isResizing) {
                    e.currentTarget.style.cursor = 'grab';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDraggingRef.current && !isResizing) {
                    e.currentTarget.style.cursor = 'default';
                  }
                }}
              >
                  <video
                    ref={(el) => {
                      if (el) {
                        videoRefs.current[peerId] = el;
                        // Assign stream if available
                        if (stream) {
                          el.srcObject = stream;
                          el.play().catch(err => console.error('Error playing video:', err));
                        }
                      }
                    }}
                    autoPlay
                    playsInline
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'block',
                      objectFit: 'cover',
                      pointerEvents: 'none',
                      userSelect: 'none'
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    background: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {user.username || 'User'}
                  </div>
                  {/* Resize Handle */}
                  <div
                    className="resize-handle"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleResizeStart(e, peerId);
                    }}
                    style={{
                      position: 'absolute',
                      bottom: '0',
                      right: '0',
                      width: '20px',
                      height: '20px',
                      background: 'rgba(99, 102, 241, 0.8)',
                      cursor: 'nwse-resize',
                      borderTopLeftRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 11
                    }}
                  >
                    <div style={{
                      width: '0',
                      height: '0',
                      borderLeft: '8px solid transparent',
                      borderBottom: '8px solid white',
                      transform: 'rotate(45deg)',
                      marginBottom: '2px',
                      marginRight: '2px'
                    }}></div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Hidden container for audio elements */}
      <div id="audio-container" style={{ display: 'none' }}></div>
    </div>
  );
}

export default VoiceChat;