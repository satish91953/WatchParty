import React, { useEffect, useRef, useState } from 'react';

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

function VoiceChat({ socket, roomId, currentUser, users, noCard = false }) {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [audioStream, setAudioStream] = useState(null);
  const [peers, setPeers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [peerLoaded, setPeerLoaded] = useState(false);
  const [peerVolumes, setPeerVolumes] = useState({}); // Track volume per peer
  const [isMinimized, setIsMinimized] = useState(false);
  
  const peersRef = useRef([]);
  const volumeRef = useRef(100);
  const peerRetryTimers = useRef({});
  const peerConnectionTimeouts = useRef({});
  const peerVolumeRefs = useRef({}); // Store volume refs per peer

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

    if (!audioEnabled) {
      try {
        setConnectionStatus('connecting');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
          } 
        });
        
        setAudioStream(stream);
        setAudioEnabled(true);
        setConnectionStatus('connected');
        
        // Notify server that we're joining voice chat
        socket.emit('join_voice_chat', { roomId });
        
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
      setPeers([]);
      
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
        
        // Notify server that we're leaving voice chat
        socket.emit('leave_voice_chat', { roomId });
        
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
        setPeers([]);
      }
    }
  };

  // Create a new peer connection (caller)
  const createPeer = (userToSignal, callerID, stream) => {
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
              setPeers(prev => {
                const newPeers = prev.filter(p => p.peerID !== userToSignal);
                return [...newPeers, peerObj];
              });
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
                setPeers(prev => {
                  const newPeers = prev.filter(p => p.peerID !== userToSignal);
                  return [...newPeers, peerObj];
                });
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
          audio.srcObject = remoteStream;
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
          
          // Add event listeners for debugging
          audio.addEventListener('loadedmetadata', () => {
            console.log('✅ Audio metadata loaded for peer:', userToSignal);
          });
          
          audio.addEventListener('play', () => {
            console.log('▶️ Audio started playing for peer:', userToSignal);
          });
          
          audio.addEventListener('error', (e) => {
            console.error('❌ Audio error for peer:', userToSignal, e);
          });
          
          // Play the audio
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log('✅ Audio playing for peer:', userToSignal);
              })
              .catch(err => {
                console.error('❌ Error playing audio for peer:', userToSignal, err);
                // Try again after user interaction
                document.addEventListener('click', () => {
                  audio.play().catch(e => console.error('Still cannot play:', e));
                }, { once: true });
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
  };

  // Add a peer connection (receiver)
  const addPeer = (incomingSignal, callerID, stream) => {
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
          audio.srcObject = remoteStream;
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
          
          // Add event listeners for debugging
          audio.addEventListener('loadedmetadata', () => {
            console.log('✅ Audio metadata loaded for peer:', callerID);
          });
          
          audio.addEventListener('play', () => {
            console.log('▶️ Audio started playing for peer:', callerID);
          });
          
          audio.addEventListener('error', (e) => {
            console.error('❌ Audio error for peer:', callerID, e);
          });
          
          // Play the audio
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log('✅ Audio playing for peer:', callerID);
              })
              .catch(err => {
                console.error('❌ Error playing audio for peer:', callerID, err);
                // Try again after user interaction
                document.addEventListener('click', () => {
                  audio.play().catch(e => console.error('Still cannot play:', e));
                }, { once: true });
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
  };

  // Handle incoming voice chat connections
  useEffect(() => {
    if (!socket || !peerLoaded) return;

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
          setPeers(prev => [...prev, peerObj]);
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
          setPeers(prev => [...prev, peerObj]);
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
          setPeers(prev => prev.filter(p => p.peerID !== payload.requestingUserId));
        }
        
        // Create new peer connection
        const peer = createPeer(payload.requestingUserId, socket.id, audioStream);
        if (peer) {
          const peerObj = { peerID: payload.requestingUserId, peer };
          peersRef.current.push(peerObj);
          setPeers(prev => [...prev, peerObj]);
          // Initialize volume for this peer if not already set
          if (peerVolumeRefs.current[payload.requestingUserId] === undefined) {
            peerVolumeRefs.current[payload.requestingUserId] = 100;
            setPeerVolumes(prev => ({ ...prev, [payload.requestingUserId]: 100 }));
          }
          console.log('✅ Recreated peer for retry:', payload.requestingUserId);
        }
      }
    });

    // When a user leaves
    socket.on('user_left', payload => {
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
      
      const newPeers = peersRef.current.filter(p => p.peerID !== payload.userId);
      peersRef.current = newPeers;
      setPeers(newPeers);
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
      socket.off('new_user_joined_voice');
      socket.off('retry_voice_connection');
    };
  }, [socket, audioStream, peerLoaded]);

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

  // Handle volume change for incoming audio (global)
  const handleVolumeChange = (e) => {
    const newVolume = e.target.value;
    setVolume(newVolume);
    volumeRef.current = newVolume;
    
    // Apply volume to all audio elements (for backward compatibility)
    document.querySelectorAll('#audio-container audio').forEach(audio => {
      const peerId = audio.getAttribute('data-peer-id');
      // Only update if no individual volume is set for this peer
      if (!peerId || !peerVolumeRefs.current[peerId]) {
      audio.volume = newVolume / 100;
      }
    });
  };

  // Handle volume change for a specific peer
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

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#28a745';
      case 'connecting': return '#ffc107';
      case 'error': return '#dc3545';
      default: return '#6c757d';
    }
  };

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
      ...(noCard ? {
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        marginBottom: 0,
        padding: '20px'
      } : {})
    }}>
      {!noCard && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: isMinimized ? '0' : '20px'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>🎤 Voice Chat</h3>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '6px 12px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.borderColor = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            {isMinimized ? '▼ Expand' : '▲ Minimize'}
          </button>
        </div>
      )}
      
      {isMinimized && !noCard ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}>
          <span style={{
            padding: '6px 14px',
            background: connectionStatus === 'connected' 
              ? 'linear-gradient(135deg, #28a745, #20c997)'
              : connectionStatus === 'connecting'
              ? 'linear-gradient(135deg, #ffc107, #ff9800)'
              : connectionStatus === 'error'
              ? 'linear-gradient(135deg, #dc3545, #c82333)'
              : 'var(--bg-tertiary)',
            color: connectionStatus === 'disconnected' ? 'var(--text-secondary)' : 'white',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '600',
            boxShadow: connectionStatus !== 'disconnected' ? '0 2px 4px rgba(0, 0, 0, 0.2)' : 'none'
          }}>
            {getStatusIcon()} {getStatusText()}
          </span>
          {audioEnabled && (
            <span style={{ 
              color: 'var(--text-primary)', 
              fontSize: '13px',
              fontWeight: '500'
            }}>
              {peers.length} user{peers.length !== 1 ? 's' : ''} connected
            </span>
          )}
        </div>
      ) : (
        <>
      
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
                minWidth: '120px',
                padding: '12px 18px',
                fontSize: '14px',
                fontWeight: '600',
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

            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              padding: '10px 16px',
              background: 'var(--bg-tertiary)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)'
            }}>
              <label htmlFor="volume" style={{ fontSize: '18px', cursor: 'pointer' }}>🔊</label>
              <input
                id="volume"
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={handleVolumeChange}
                style={{ 
                  width: '100px',
                  accentColor: '#007bff',
                  cursor: 'pointer'
                }}
              />
              <span style={{ 
                fontSize: '13px', 
                minWidth: '40px',
                fontWeight: '600',
                color: 'var(--text-primary)'
              }}>
                {volume}%
              </span>
            </div>
          </>
        )}
      </div>

      <div style={{ 
        background: 'var(--bg-secondary)', 
        padding: '18px', 
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ 
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <strong style={{ color: 'var(--text-primary)', fontSize: '15px' }}>Status:</strong> 
          <span style={{
            padding: '6px 14px',
            background: connectionStatus === 'connected' 
              ? 'linear-gradient(135deg, #28a745, #20c997)'
              : connectionStatus === 'connecting'
              ? 'linear-gradient(135deg, #ffc107, #ff9800)'
              : connectionStatus === 'error'
              ? 'linear-gradient(135deg, #dc3545, #c82333)'
              : 'var(--bg-tertiary)',
            color: connectionStatus === 'disconnected' ? 'var(--text-secondary)' : 'white',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            boxShadow: connectionStatus !== 'disconnected' ? '0 2px 4px rgba(0, 0, 0, 0.2)' : 'none'
          }}>
            {getStatusIcon()} {getStatusText()}
          </span>
        </div>
        
        {audioEnabled && (
          <>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '10px',
              background: 'var(--bg-tertiary)',
              borderRadius: '8px',
              marginTop: '10px'
            }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                <strong>Connected:</strong> {peers.length} user{peers.length !== 1 ? 's' : ''}
            </span>
            {micMuted && (
                <span style={{ 
                  color: '#ffc107', 
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  background: 'rgba(255, 193, 7, 0.1)',
                  borderRadius: '6px'
                }}>
                🔇 Microphone muted
              </span>
            )}
          </div>
            
            {/* Individual volume controls for each participant */}
            {peers.length > 0 && (
              <div style={{ 
                marginTop: '16px',
                padding: '12px',
                background: 'var(--bg-tertiary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                <strong style={{ 
                  color: 'var(--text-primary)', 
                  fontSize: '14px',
                  display: 'block',
                  marginBottom: '12px'
                }}>
                  🔊 Participant Volumes:
                </strong>
                {peers.map((peerObj) => {
                  const peerId = peerObj.peerID; // This is socket.id
                  const peerVolume = peerVolumes[peerId] !== undefined ? peerVolumes[peerId] : 100;
                  // Find user info from users array - match by socketId first, then userId
                  const peerUser = users.find(u => u.socketId === peerId || u.userId === peerId) || { username: `Guest-${peerId.substring(0, 6)}` };
                  const displayName = peerUser.username || `Guest-${peerId.substring(0, 6)}`;
                  
                  return (
                    <div key={peerId} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px',
                      marginBottom: '8px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)'
                    }}>
                      <span style={{ 
                        fontSize: '12px', 
                        color: 'var(--text-primary)',
                        minWidth: '80px',
                        fontWeight: '500'
                      }}>
                        {displayName}:
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={peerVolume}
                        onChange={(e) => handlePeerVolumeChange(peerId, parseInt(e.target.value))}
                        style={{ 
                          flex: 1,
                          accentColor: '#007bff',
                          cursor: 'pointer'
                        }}
                      />
                      <span style={{ 
                        fontSize: '12px', 
                        minWidth: '35px',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        textAlign: 'right'
                      }}>
                        {peerVolume}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {!audioEnabled && peerLoaded && (
          <div style={{ 
            color: 'var(--text-secondary)', 
            fontSize: '13px', 
            marginTop: '12px',
            padding: '12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '8px',
            textAlign: 'center',
            lineHeight: '1.6'
          }}>
            💡 Click "Join Voice" to start talking with others in the room
          </div>
        )}

        {connectionStatus === 'error' && (
          <div style={{ 
            color: '#dc3545', 
            fontSize: '13px', 
            marginTop: '12px',
            padding: '12px',
            background: 'rgba(220, 53, 69, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(220, 53, 69, 0.3)',
            fontWeight: '500'
          }}>
            ⚠️ Voice chat error. Please check your microphone and try again.
          </div>
        )}
      </div>

      {/* Hidden container for audio elements */}
      <div id="audio-container" style={{ display: 'none' }}></div>
        </>
      )}
    </div>
  );
}

export default VoiceChat;