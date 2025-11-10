import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';

const VideoPlayer = forwardRef(({ socket, roomId, currentUser, initialVideo, isHost, room }, ref) => {
  const videoRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const youtubeContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState(initialVideo?.url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
  const [videoTitle, setVideoTitle] = useState(initialVideo?.title || 'Sample Video - Big Buck Bunny');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentVideoFile, setCurrentVideoFile] = useState(null);
  const [playerError, setPlayerError] = useState('');
  const [playerReady, setPlayerReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [hostVideo, setHostVideo] = useState(null);
  const [videoLibrary, setVideoLibrary] = useState([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const speedSyncInProgress = useRef(false);
  const [isYouTube, setIsYouTube] = useState(false);
  const [youtubeVideoId, setYoutubeVideoId] = useState(null);
  const youtubeSyncInProgress = useRef(false);
  
  // Refs to prevent sync loops
  const syncTimeoutRef = useRef(null);
  const lastEventTime = useRef(0);
  const ignoreNextEvent = useRef(false);
  const isHostRef = useRef(false);
  const syncInProgress = useRef(false);
  const videoInitialized = useRef(false);
  const lastSyncTimeRef = useRef(0);
  const youtubeSyncIntervalRef = useRef(null);

  // Expose video ref to parent
  useImperativeHandle(ref, () => ({
    current: videoRef.current
  }));

  // Fetch video library when room changes
  useEffect(() => {
    if (!roomId) return;
    
    const fetchVideoLibrary = async () => {
      try {
        const apiUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
        const response = await fetch(`${apiUrl}/api/rooms/${roomId}/videos`);
        if (response.ok) {
          const data = await response.json();
          setVideoLibrary(data.library || []);
          if (data.currentVideo?.url) {
            setHostVideo(data.currentVideo);
          }
        }
      } catch (error) {
        console.error('Error fetching video library:', error);
      }
    };
    
    fetchVideoLibrary();
  }, [roomId]);

  // Check if current video URL is YouTube and update state
  useEffect(() => {
    const youtubeCheck = isYouTubeUrl(videoUrl);
    setIsYouTube(youtubeCheck);
    
    if (youtubeCheck) {
      const videoId = extractYouTubeId(videoUrl);
      setYoutubeVideoId(videoId);
      console.log('📺 YouTube video detected:', videoId);
    } else {
      setYoutubeVideoId(null);
    }
  }, [videoUrl]);

  // Initialize YouTube Player
  useEffect(() => {
    if (!isYouTube || !youtubeVideoId) return;
    
    // Wait for YouTube IFrame API to load
    if (typeof window.YT === 'undefined' || typeof window.YT.Player === 'undefined') {
      console.log('⏳ Waiting for YouTube IFrame API to load...');
      const checkInterval = setInterval(() => {
        if (typeof window.YT !== 'undefined' && typeof window.YT.Player !== 'undefined') {
          clearInterval(checkInterval);
          // Small delay to ensure container is rendered
          setTimeout(() => initializeYouTubePlayer(), 100);
        }
      }, 100);
      
      return () => clearInterval(checkInterval);
    }
    
    // Small delay to ensure container is rendered
    const timeoutId = setTimeout(() => initializeYouTubePlayer(), 100);
    
    function initializeYouTubePlayer() {
      if (!youtubeContainerRef.current) {
        console.warn('YouTube container not ready yet');
        return;
      }
      
      if (youtubePlayerRef.current) {
        // Destroy existing player
        try {
          youtubePlayerRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying existing YouTube player:', e);
        }
        youtubePlayerRef.current = null;
      }
      
      console.log('📺 Initializing YouTube player for video:', youtubeVideoId);
      
      try {
        youtubePlayerRef.current = new window.YT.Player(youtubeContainerRef.current, {
          videoId: youtubeVideoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            enablejsapi: 1
          },
          events: {
            onReady: (event) => {
              console.log('✅ YouTube player ready');
              setPlayerReady(true);
              setPlayerError('');
            },
            onStateChange: (event) => {
              if (youtubeSyncInProgress.current) {
                return;
              }
              
              // YouTube player states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
              if (event.data === window.YT.PlayerState.PLAYING) {
                // Video started playing - get time immediately
                const currentTime = event.target.getCurrentTime();
                if (socket && roomId && !syncInProgress.current) {
                  // Use requestAnimationFrame for immediate emission
                  requestAnimationFrame(() => {
                    socket.emit('video_play', {
                      roomId,
                      currentTime,
                      initiatedBy: currentUser
                    });
                  });
                }
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                // Video paused - get time immediately
                const currentTime = event.target.getCurrentTime();
                if (socket && roomId && !syncInProgress.current) {
                  // Use requestAnimationFrame for immediate emission
                  requestAnimationFrame(() => {
                    socket.emit('video_pause', {
                      roomId,
                      currentTime,
                      initiatedBy: currentUser
                    });
                  });
                }
              }
            },
            onError: (event) => {
              console.error('❌ YouTube player error:', event.data);
              setPlayerError(`YouTube Error: ${getYouTubeErrorMessage(event.data)}`);
            }
          }
        });
      } catch (error) {
        console.error('Error initializing YouTube player:', error);
        setPlayerError('Failed to initialize YouTube player');
      }
    }
    
    return () => {
      clearTimeout(timeoutId);
      if (youtubePlayerRef.current) {
        try {
          youtubePlayerRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying YouTube player:', e);
        }
        youtubePlayerRef.current = null;
      }
    };
  }, [isYouTube, youtubeVideoId, socket, roomId, currentUser]);

  // Initialize native HTML5 video (only if not YouTube)
  useEffect(() => {
    if (isYouTube || !videoRef.current) return;

    const video = videoRef.current;
    
    // Only set up video if URL has actually changed
    if (video.src === videoUrl) {
      console.log('🎬 Video URL unchanged, skipping setup');
      return;
    }
    
    console.log('🎬 Setting up video with URL:', videoUrl);
    
    // Set video source
    video.src = videoUrl;
    
    // Video event listeners with debouncing
    const handleLoadStart = () => {
      console.log('📥 Video loading started');
      setPlayerError('');
    };

    const handleLoadedData = () => {
      console.log('✅ Video data loaded');
      setPlayerReady(true);
      setPlayerError('');
    };

    const handleCanPlay = () => {
      console.log('▶️ Video can start playing');
    };

    const handleError = (e) => {
      console.error('❌ Video error:', e);
      const error = video.error;
      if (error) {
        setPlayerError(`Video Error: ${getErrorMessage(error.code)}`);
      } else {
        setPlayerError('Unknown video error occurred');
      }
    };

    // Debounced event handlers - ANYONE can control playback
    const handlePlay = () => {
      const now = Date.now();
      // Don't emit if we're currently syncing or too soon after last event
      if (ignoreNextEvent.current || syncInProgress.current || now - lastEventTime.current < 1000 || !videoInitialized.current) {
        ignoreNextEvent.current = false;
        return;
      }
      
      if (socket && roomId && !isSyncing && videoInitialized.current) {
        const currentTime = video.currentTime;
        console.log('🎬 User control: Emitting play at time:', currentTime);
        socket.emit('video_play', { roomId, currentTime, initiatedBy: currentUser });
        lastEventTime.current = now;
      }
    };

    const handlePause = () => {
      const now = Date.now();
      // Don't emit if we're currently syncing or too soon after last event
      if (ignoreNextEvent.current || syncInProgress.current || now - lastEventTime.current < 1000 || !videoInitialized.current) {
        ignoreNextEvent.current = false;
        return;
      }
      
      if (socket && roomId && !isSyncing && videoInitialized.current) {
        const currentTime = video.currentTime;
        console.log('⏸️ User control: Emitting pause at time:', currentTime);
        socket.emit('video_pause', { roomId, currentTime, initiatedBy: currentUser });
        lastEventTime.current = now;
      }
    };

    const handleSeeked = () => {
      const now = Date.now();
      if (ignoreNextEvent.current || syncInProgress.current || now - lastEventTime.current < 2000 || !videoInitialized.current) {
        ignoreNextEvent.current = false;
        return;
      }
      
      if (socket && roomId && !isSyncing && videoInitialized.current) {
        const currentTime = video.currentTime;
        console.log('⏭️ User control: Emitting seek to time:', currentTime);
        socket.emit('video_seek', { roomId, currentTime, initiatedBy: currentUser });
        lastEventTime.current = now;
      }
    };

    // Add event listeners
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeked', handleSeeked);

    // Load the video
    video.load();

    // Ensure video loads properly
    const handleVideoReady = () => {
      console.log('✅ Video ready for playback');
      setPlayerReady(true);
      videoInitialized.current = true;
      
      // Set initial state if provided
      if (initialVideo) {
        video.currentTime = initialVideo.currentTime || 0;
        // Don't auto-play - browsers block it. User needs to click play button.
        // The video controls will handle play/pause
      }
    };

    // Wait for video to be ready
    if (video.readyState >= 2) {
      handleVideoReady();
    } else {
      video.addEventListener('loadeddata', handleVideoReady, { once: true });
    }

    return () => {
      // Cleanup event listeners
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, [videoUrl]); // Only depend on videoUrl, not other state

  // Listen for socket events with improved logic
  useEffect(() => {
    if (!socket) return;

    // Update dependency to include isYouTube

    const handleVideoPlay = (data) => {
      // Handle YouTube player
      if (isYouTube && youtubePlayerRef.current) {
        const socketId = socket?.id;
        const isOwnEvent = data.initiatedBy === currentUser || data.socketId === socketId;
        
        // Skip periodic sync events from same user
        if (data.isPeriodicSync && isOwnEvent) {
          return;
        }
        
        if (isOwnEvent && !syncInProgress.current && !data.isPeriodicSync) {
          return;
        }
        
        youtubeSyncInProgress.current = true;
        syncInProgress.current = true;
        setIsSyncing(true);
        
        try {
          const currentTime = youtubePlayerRef.current.getCurrentTime();
          const targetTime = data.currentTime || currentTime;
          const timeDiff = Math.abs(currentTime - targetTime);
          
          // Seek to target time if needed (reduced threshold for better sync)
          if (timeDiff > 0.1) {
            youtubePlayerRef.current.seekTo(targetTime, true);
            // Minimal wait for seek to complete before playing
            setTimeout(() => {
              youtubePlayerRef.current.playVideo();
            }, 30);
          } else {
            // Play immediately if time is close enough
            youtubePlayerRef.current.playVideo();
          }
          
          // Reduced timeout for faster response
          setTimeout(() => {
            youtubeSyncInProgress.current = false;
            syncInProgress.current = false;
            setIsSyncing(false);
          }, 600);
        } catch (error) {
          console.error('Error syncing YouTube play:', error);
          youtubeSyncInProgress.current = false;
          syncInProgress.current = false;
          setIsSyncing(false);
        }
        return;
      }
      
      // Handle HTML5 video
      if (!videoRef.current) return;
      
      const video = videoRef.current;
      const socketId = socket?.id;
      console.log('📥 PLAY EVENT RECEIVED:', { 
        initiatedBy: data.initiatedBy, 
        eventSocketId: data.socketId,
        currentUser, 
        mySocketId: socketId,
        matchInitiated: data.initiatedBy === currentUser,
        matchSocketId: data.socketId === socketId || data.initiatedBy === socketId,
        syncInProgress: syncInProgress.current,
        videoPaused: video.paused
      });
      
      // Don't process if it's our own event (prevent loop)
      // Check both initiatedBy and socketId for maximum compatibility
      const isOwnEvent = data.initiatedBy === currentUser || 
                        data.initiatedBy === socketId ||
                        data.socketId === socketId ||
                        data.socketId === currentUser;
      
      if (isOwnEvent && !syncInProgress.current) {
        console.log('🚫 Ignoring own play event');
        return;
      }
      
      console.log('🔄 Processing play sync from another user at time:', data.currentTime);
      
      // Set flags BEFORE playing to prevent loop
      syncInProgress.current = true;
      setIsSyncing(true);
      ignoreNextEvent.current = true;
      
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      try {
        // Ensure video is loaded before syncing
        if (video.readyState < 2) {
          console.log('⏳ Video not ready, waiting...');
          video.addEventListener('loadeddata', () => {
            console.log('✅ Video loaded, now syncing...');
            syncVideoPlay(video, data.currentTime);
          }, { once: true });
          return;
        }
        
        syncVideoPlay(video, data.currentTime);
        
      } catch (error) {
        console.error('Error in sync play:', error);
      }

      // Reset sync flag after delay
      syncTimeoutRef.current = setTimeout(() => {
        setIsSyncing(false);
        syncInProgress.current = false;
      }, 2000);
    };

    const syncVideoPlay = (video, targetTime) => {
      try {
        const timeDiff = Math.abs(video.currentTime - targetTime);
        
        // Only seek if there's a significant time difference
        if (timeDiff > 0.5) {
          video.currentTime = targetTime;
          console.log('⏭️ Synced time to:', targetTime);
        }
        
        if (video.paused) {
          console.log('▶️ Starting playback...');
          // Try to play - if it fails due to browser restrictions, that's okay
          video.play().catch(err => {
            if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
              console.error('Sync play failed:', err);
            }
            // NotAllowedError is expected for autoplay - user will need to click play
          });
        }
      } catch (error) {
        console.error('Error in syncVideoPlay:', error);
      }
    };

    const handleVideoPause = (data) => {
      // Handle YouTube player
      if (isYouTube && youtubePlayerRef.current) {
        const socketId = socket?.id;
        const isOwnEvent = data.initiatedBy === currentUser || data.socketId === socketId;
        if (isOwnEvent && !syncInProgress.current) {
          return;
        }
        
        youtubeSyncInProgress.current = true;
        syncInProgress.current = true;
        setIsSyncing(true);
        
        try {
          const currentTime = youtubePlayerRef.current.getCurrentTime();
          const targetTime = data.currentTime || currentTime;
          const timeDiff = Math.abs(currentTime - targetTime);
          
          // Seek to target time if needed (reduced threshold for better sync)
          if (timeDiff > 0.1) {
            youtubePlayerRef.current.seekTo(targetTime, true);
            // Minimal wait for seek to complete before pausing
            setTimeout(() => {
              youtubePlayerRef.current.pauseVideo();
            }, 30);
          } else {
            // Pause immediately if time is close enough
            youtubePlayerRef.current.pauseVideo();
          }
          
          // Reduced timeout for faster response
          setTimeout(() => {
            youtubeSyncInProgress.current = false;
            syncInProgress.current = false;
            setIsSyncing(false);
          }, 600);
        } catch (error) {
          console.error('Error syncing YouTube pause:', error);
          youtubeSyncInProgress.current = false;
          syncInProgress.current = false;
          setIsSyncing(false);
        }
        return;
      }
      
      // Handle HTML5 video
      if (!videoRef.current) return;
      
      const video = videoRef.current;
      const socketId = socket?.id;
      console.log('📥 PAUSE EVENT RECEIVED:', { 
        initiatedBy: data.initiatedBy, 
        eventSocketId: data.socketId,
        currentUser, 
        mySocketId: socketId,
        matchInitiated: data.initiatedBy === currentUser,
        matchSocketId: data.socketId === socketId || data.initiatedBy === socketId,
        videoPaused: video.paused,
        videoReady: video.readyState
      });
      
      // Don't process if it's our own event (prevent loop)
      // Check both initiatedBy and socketId for maximum compatibility
      const isOwnEvent = data.initiatedBy === currentUser || 
                        data.initiatedBy === socketId ||
                        data.socketId === socketId ||
                        data.socketId === currentUser;
      
      if (isOwnEvent && !syncInProgress.current) {
        console.log('🚫 Ignoring own pause event');
        return;
      }
      
      console.log('🔄 PROCESSING PAUSE - Pausing video now!');
      
      // IMMEDIATELY set flags to prevent any interference
      syncInProgress.current = true;
      setIsSyncing(true);
      ignoreNextEvent.current = true;
      
      // Clear any existing timeouts
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      // PAUSE IMMEDIATELY - don't wait for anything
      const pauseVideo = () => {
        try {
          console.log('⏸️ FORCING PAUSE - Current state:', {
            paused: video.paused,
            currentTime: video.currentTime,
            readyState: video.readyState
          });
          
          // Sync time first if needed (but don't wait for it)
          if (data.currentTime !== undefined) {
            const timeDiff = Math.abs(video.currentTime - data.currentTime);
        if (timeDiff > 0.5) {
          video.currentTime = data.currentTime;
              console.log('⏭️ Synced time to:', data.currentTime);
            }
        }
        
          // CRITICAL: Force pause immediately - use multiple strategies
        if (!video.paused) {
            // Strategy 1: Direct pause
          video.pause();
            console.log('✅ Pause() called (attempt 1)');
            
            // Strategy 2: Use requestAnimationFrame for immediate execution
            requestAnimationFrame(() => {
              if (!video.paused) {
                video.pause();
                console.log('✅ Pause() called (attempt 2 - RAF)');
              }
            });
            
            // Strategy 3: Verify and retry after short delay
            setTimeout(() => {
              if (!video.paused) {
                console.warn('⚠️ Video still playing, forcing pause again...');
                video.pause();
                // Try one more time
                setTimeout(() => {
                  if (!video.paused) {
                    console.warn('⚠️ Final pause attempt...');
                    video.pause();
                    // Last resort: set paused property directly (if supported)
                    try {
                      if (video.paused === false) {
                        video.pause();
                      }
                    } catch (e) {
                      console.error('Could not force pause:', e);
                    }
                  } else {
                    console.log('✅ Video successfully paused (after retry)');
                  }
                }, 50);
              } else {
                console.log('✅ Video successfully paused');
              }
            }, 50);
          } else {
            console.log('✅ Video already paused');
        }
        
      } catch (error) {
          console.error('❌ Error pausing video:', error);
        }
      };

      // Execute pause immediately - don't wait for video ready state
      // Most browsers can pause even if video isn't fully loaded
      try {
        pauseVideo();
      } catch (e) {
        console.warn('Immediate pause failed, waiting for video ready:', e);
        // Fallback: wait for video to be ready
        if (video.readyState < 2) {
          console.log('⏳ Video not ready, waiting...');
          const onReady = () => {
            console.log('✅ Video ready, pausing now');
            pauseVideo();
          };
          video.addEventListener('loadeddata', onReady, { once: true });
          video.addEventListener('canplay', onReady, { once: true });
        } else {
          pauseVideo();
        }
      }

      // Reset sync flags after delay
      syncTimeoutRef.current = setTimeout(() => {
        console.log('🔄 Resetting sync flags');
        setIsSyncing(false);
        syncInProgress.current = false;
      }, 1500);
    };

    const handleVideoSeek = (data) => {
      if (data.initiatedBy === currentUser || syncInProgress.current) {
        console.log('🚫 Ignoring own seek event or sync in progress');
        return;
      }
      
      // Handle YouTube player
      if (isYouTube && youtubePlayerRef.current) {
        try {
          const currentTime = youtubePlayerRef.current.getCurrentTime();
          const targetTime = data.currentTime;
          
          // Only seek if there's a significant difference (reduced threshold)
          if (Math.abs(currentTime - targetTime) > 0.1) {
            youtubeSyncInProgress.current = true;
            youtubePlayerRef.current.seekTo(targetTime, true);
            console.log('⏭️ Synced YouTube seek to time:', targetTime);
            
            // Reset sync flag faster
            setTimeout(() => {
              youtubeSyncInProgress.current = false;
            }, 500);
          }
        } catch (error) {
          console.error('Error syncing YouTube seek:', error);
          youtubeSyncInProgress.current = false;
        }
        return;
      }
      
      // Handle HTML5 video
      if (!videoRef.current) return;
      
      const video = videoRef.current;
      console.log('🔄 Received seek sync from another user to time:', data.currentTime);
      syncInProgress.current = true;
      setIsSyncing(true);
      ignoreNextEvent.current = true;
      
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      try {
        video.currentTime = data.currentTime;
        console.log('⏭️ Synced seek to time:', data.currentTime);
      } catch (error) {
        console.error('Error in sync seek:', error);
      }

      syncTimeoutRef.current = setTimeout(() => {
        setIsSyncing(false);
        syncInProgress.current = false;
      }, 3000);
    };

    const handleVideoUrlChange = (data) => {
      if (data.initiatedBy === currentUser) return;
      
      console.log('🔄 Received video URL change:', data.videoUrl);
      
      if (data.videoUrl.startsWith('blob:')) {
        alert(`${data.initiatedBy} loaded a local video file. You'll need to load the same file on your device to sync.`);
        return;
      }
      
      setVideoUrl(data.videoUrl);
      setVideoTitle(data.videoTitle || 'Remote Video');
    };

    const handleVideoUploaded = (data) => {
      console.log('🎬 User uploaded a video:', data);
      
      // Add to library
      setVideoLibrary(prev => [...prev, data]);
      
      // Automatically load the uploaded video for all users
      setVideoUrl(data.videoUrl);
      setVideoTitle(data.videoTitle);
      setHostVideo(data);
      setCurrentVideoFile(null);
      setPlayerError('');
      setPlayerReady(false);
      
      // Show notification to other users
      if (data.uploadedBy !== currentUser) {
        alert(`🎬 ${data.uploadedBy || 'Someone'} uploaded a new video: ${data.videoTitle}`);
      }
    };

    const handleVideoSelected = (data) => {
      console.log('🎬 User selected video:', data);
      
      setVideoUrl(data.videoUrl);
      setVideoTitle(data.videoTitle);
      setHostVideo(data);
      setCurrentVideoFile(null);
      setPlayerError('');
      setPlayerReady(false);
      
      if (data.selectedBy !== currentUser) {
        alert(`🎬 ${data.selectedBy || 'Someone'} selected: ${data.videoTitle}`);
      }
    };

    const handleVideoSpeedChange = (data) => {
      if (data.initiatedBy === currentUser) {
        console.log('🚫 Ignoring own speed change event');
        return;
      }
      
      console.log('⚡ Received speed change from another user:', data.speed);
      speedSyncInProgress.current = true;
      setPlaybackSpeed(data.speed);
      
      if (videoRef.current) {
        videoRef.current.playbackRate = data.speed;
      }
      
      // Reset flag after a short delay
      setTimeout(() => {
        speedSyncInProgress.current = false;
      }, 500);
    };

    socket.on('video_play', handleVideoPlay);
    socket.on('video_pause', handleVideoPause);
    socket.on('video_seek', handleVideoSeek);
    socket.on('video_url_change', handleVideoUrlChange);
    socket.on('video_uploaded', handleVideoUploaded);
    socket.on('host_video_uploaded', handleVideoUploaded); // Keep for backward compatibility
    socket.on('video_selected', handleVideoSelected);
    socket.on('video_speed_change', handleVideoSpeedChange);

    return () => {
      socket.off('video_play', handleVideoPlay);
      socket.off('video_pause', handleVideoPause);
      socket.off('video_seek', handleVideoSeek);
      socket.off('video_url_change', handleVideoUrlChange);
      socket.off('video_uploaded', handleVideoUploaded);
      socket.off('host_video_uploaded', handleVideoUploaded);
      socket.off('video_selected', handleVideoSelected);
      socket.off('video_speed_change', handleVideoSpeedChange);
    };
  }, [socket, currentUser, isYouTube, roomId]);

  // Periodic sync for YouTube videos to prevent drift
  useEffect(() => {
    if (!isYouTube || !youtubePlayerRef.current || !socket || !roomId) {
      if (youtubeSyncIntervalRef.current) {
        clearInterval(youtubeSyncIntervalRef.current);
        youtubeSyncIntervalRef.current = null;
      }
      return;
    }

    // Sync every 2 seconds to prevent drift
    youtubeSyncIntervalRef.current = setInterval(() => {
      if (youtubeSyncInProgress.current || syncInProgress.current) {
        return;
      }

      try {
        const currentTime = youtubePlayerRef.current.getCurrentTime();
        const playerState = youtubePlayerRef.current.getPlayerState();
        
        // Only sync if video is playing
        if (playerState === window.YT.PlayerState.PLAYING) {
          // Emit current time to keep others in sync
          socket.emit('video_play', {
            roomId,
            currentTime,
            initiatedBy: currentUser,
            isPeriodicSync: true
          });
        }
      } catch (error) {
        console.error('Error in periodic YouTube sync:', error);
      }
    }, 2000);

    return () => {
      if (youtubeSyncIntervalRef.current) {
        clearInterval(youtubeSyncIntervalRef.current);
        youtubeSyncIntervalRef.current = null;
      }
    };
  }, [isYouTube, socket, roomId, currentUser]);

  const getErrorMessage = (code) => {
    switch (code) {
      case 1: return 'Video loading aborted';
      case 2: return 'Network error';
      case 3: return 'Video decode error';
      case 4: return 'Video format not supported';
      default: return 'Unknown error';
    }
  };

  const getVideoType = (url) => {
    if (url.includes('.webm')) return 'video/webm';
    if (url.includes('.ogg')) return 'video/ogg';
    if (url.includes('.mov')) return 'video/quicktime';
    if (url.includes('.avi')) return 'video/x-msvideo';
    return 'video/mp4';
  };

  // Check if URL is a YouTube URL
  const isYouTubeUrl = (url) => {
    if (!url) return false;
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return youtubeRegex.test(url);
  };

  // Extract YouTube video ID from URL
  const extractYouTubeId = (url) => {
    if (!url) return null;
    
    // Handle different YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  };

  // Get YouTube error message
  const getYouTubeErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 2: return 'Invalid video ID';
      case 5: return 'HTML5 player error';
      case 100: return 'Video not found';
      case 101: return 'Video not allowed to be played in embedded players';
      case 150: return 'Video not allowed to be played in embedded players';
      default: return 'Unknown YouTube error';
    }
  };

  const loadNewVideo = () => {
    if (!newVideoUrl.trim()) return;
    
    setIsLoading(true);
    setPlayerError('');
    setPlayerReady(false);
    
    const url = newVideoUrl.trim();
    let title = extractVideoTitle(url);
    
    // If it's a YouTube URL, extract a better title
    if (isYouTubeUrl(url)) {
      const videoId = extractYouTubeId(url);
      if (videoId) {
        title = `YouTube Video - ${videoId}`;
      }
    }
    
    setVideoUrl(url);
    setVideoTitle(title);
    setCurrentVideoFile(null);
    
    if (socket && roomId) {
      socket.emit('video_url_change', {
        roomId,
        videoUrl: url,
        videoTitle: title
      });
    }
    
    setNewVideoUrl('');
    setIsLoading(false);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      alert('Please select a video file (MP4, WebM, MOV, etc.)');
      return;
    }

    const maxSize = 1024 * 1024 * 1024; // 1GB limit
    if (file.size > maxSize) {
      alert('File is too large. Please select a video smaller than 1GB.');
      return;
    }

    // Any user can upload to server - everyone gets access
    await uploadVideoToServer(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadVideoToServer = async (file) => {
    setIsUploading(true);
    setUploadProgress(0);
    setPlayerError('');
    
    try {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('userId', currentUser);
      
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          console.log('Video uploaded successfully:', response);
          
          // Video will be automatically loaded via socket event
          setHostVideo(response.video);
          setPlayerError('');
        } else {
          const error = JSON.parse(xhr.responseText);
          setPlayerError(`Upload failed: ${error.message}`);
        }
        setIsUploading(false);
        setUploadProgress(0);
      });
      
      xhr.addEventListener('error', () => {
        setPlayerError('Upload failed: Network error');
        setIsUploading(false);
        setUploadProgress(0);
      });
      
      const apiUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
      xhr.open('POST', `${apiUrl}/api/rooms/${roomId}/upload-video`);
      xhr.send(formData);
      
    } catch (error) {
      console.error('Upload error:', error);
      setPlayerError('Upload failed: ' + error.message);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleLocalFileUpload = (file) => {
    setIsLoading(true);
    setPlayerError('');
    setPlayerReady(false);
    
    try {
      if (videoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl);
      }
      
      const blobUrl = URL.createObjectURL(file);
      const title = `Local: ${file.name}`;
      
      setVideoUrl(blobUrl);
      setVideoTitle(title);
      setCurrentVideoFile(file);
      
      if (socket && roomId) {
        socket.emit('video_url_change', {
          roomId,
          videoUrl: blobUrl,
          videoTitle: title
        });
      }
      
      console.log('Local file loaded:', title);
      
    } catch (error) {
      console.error('Error loading file:', error);
      setPlayerError('Failed to load local file');
    }
    
    setIsLoading(false);
  };

  const extractVideoTitle = (url) => {
    try {
      const urlObj = new URL(url);
      const filename = urlObj.pathname.split('/').pop();
      return filename || 'Custom Video';
    } catch {
      return 'Custom Video';
    }
  };

  const testVideo = () => {
    if (videoRef.current) {
      console.log('🧪 Testing video playback...');
      videoRef.current.play().then(() => {
        console.log('✅ Video play successful');
        setPlayerError('');
      }).catch(err => {
        if (err.name !== 'AbortError') {
          console.error('❌ Video play failed:', err);
          setPlayerError(`Play failed: ${err.message}`);
        }
      });
    } else {
      setPlayerError('Video element not ready');
    }
  };

  const resetSync = () => {
    console.log('🔄 Resetting sync state...');
    setIsSyncing(false);
    isHostRef.current = false;
    ignoreNextEvent.current = false;
    lastEventTime.current = 0;
    syncInProgress.current = false;
    videoInitialized.current = false;
    
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
  };

  const forceSync = () => {
    if (!socket || !roomId || !videoRef.current) return;
    
    const video = videoRef.current;
    const currentTime = video.currentTime;
    const isPlaying = !video.paused;
    
    console.log('🔄 Force syncing:', { currentTime, isPlaying });
    
    if (isPlaying) {
      socket.emit('video_play', { roomId, currentTime });
    } else {
      socket.emit('video_pause', { roomId, currentTime });
    }
  };

  const selectVideoFromLibrary = async (video) => {
    // Any user can select videos from the library
    if (!video || !video.url) {
      setPlayerError('Invalid video data');
      console.error('Invalid video object:', video);
      return;
    }
    
    console.log('Selecting video from library:', { title: video.title, url: video.url });
    
    try {
      const apiUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/rooms/${roomId}/select-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          videoUrl: video.url,
          userId: currentUser
        })
      });
      
      if (response.ok) {
        // Video will be loaded via socket event
        console.log('Video selected successfully:', video.title);
        setPlayerError('');
      } else {
        const error = await response.json();
        console.error('Selection error:', error);
        setPlayerError(`Failed to select video: ${error.message}`);
        
        // Show debug info if available
        if (error.debug) {
          console.error('Debug info:', error.debug);
          console.error('Available videos in library:', videoLibrary.map(v => ({ title: v.title, url: v.url })));
        }
      }
    } catch (error) {
      console.error('Error selecting video:', error);
      setPlayerError('Failed to select video: Network error');
    }
  };

  const sampleVideos = [
    {
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      title: 'Big Buck Bunny'
    },
    {
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      title: 'Elephants Dream'
    },
    {
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      title: 'For Bigger Blazes'
    },
    {
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      title: 'Sintel'
    }
  ];

  const loadSampleVideo = (sample) => {
    setPlayerError('');
    setPlayerReady(false);
    resetSync();
    
    if (videoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(videoUrl);
    }
    
    setVideoUrl(sample.url);
    setVideoTitle(sample.title);
    setCurrentVideoFile(null);
    
    if (socket && roomId) {
      socket.emit('video_url_change', {
        roomId,
        videoUrl: sample.url,
        videoTitle: sample.title
      });
    }
  };

  // Apply playback speed to video
  useEffect(() => {
    if (videoRef.current && !speedSyncInProgress.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const handleSpeedChange = (speed) => {
    // Don't emit if we're syncing from another user
    if (speedSyncInProgress.current) {
      speedSyncInProgress.current = false;
      return;
    }
    
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    
    // Emit speed change to other users
    if (socket && roomId && !speedSyncInProgress.current) {
      console.log('⚡ Emitting speed change:', speed);
      socket.emit('video_speed_change', { 
        roomId, 
        speed, 
        initiatedBy: currentUser 
      });
    }
  };

  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (videoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, []);

  return (
    <div className="component-card">
      <h3>🎬 Video Player - Everyone Can Control!</h3>
      
      {/* Player Status */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap' }}>
          {isSyncing && (
            <span style={{ 
              padding: '6px 12px', 
              borderRadius: '6px', 
              fontSize: '12px',
              background: 'linear-gradient(135deg, #dc3545, #c82333)',
              color: 'white',
              fontWeight: '500',
              animation: 'pulse 1.5s infinite'
            }}>
              🔄 Syncing...
            </span>
          )}
          
          <button 
            onClick={testVideo}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              background: '#17a2b8'
            }}
          >
            🧪 Test
          </button>

          <button 
            onClick={resetSync}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              background: '#6f42c1'
            }}
          >
            🔄 Reset Sync
          </button>

          <button 
            onClick={forceSync}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              background: '#fd7e14'
            }}
          >
            ⚡ Force Sync
          </button>

          <button 
            onClick={() => {
              if (videoRef.current) {
                console.log('🎬 Manual play test');
                videoRef.current.play().catch(err => {
                  if (err.name !== 'AbortError') {
                    console.error('Manual play failed:', err);
                  }
                });
              }
            }}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              background: '#20c997'
            }}
          >
            ▶️ Manual Play
          </button>

          <span style={{ 
            padding: '4px 8px', 
            borderRadius: '4px', 
            fontSize: '11px',
            background: '#333',
            color: '#ccc'
          }}>
            ID: {currentUser?.substring(0, 8)}
          </span>
        </div>
        
        {playerError && (
          <div style={{
            background: '#dc3545',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            marginBottom: '10px'
          }}>
            ❌ {playerError}
          </div>
        )}
      </div>
      
      {/* Video Container */}
      <div style={{
        background: '#000',
        borderRadius: '16px',
        overflow: 'hidden',
        marginBottom: '24px',
        border: '3px solid #28a745',
        position: 'relative',
        boxShadow: '0 8px 24px rgba(40, 167, 69, 0.3)',
        transition: 'all 0.3s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 12px 32px rgba(40, 167, 69, 0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(40, 167, 69, 0.3)';
      }}
      >
        {isYouTube ? (
          <div style={{
            width: '100%',
            paddingBottom: '56.25%', // 16:9 aspect ratio
            position: 'relative',
            height: 0,
            overflow: 'hidden',
            background: '#000'
          }}>
            <div 
              ref={youtubeContainerRef}
              id={`youtube-player-${roomId || 'default'}`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%'
              }}
            >
              {/* YouTube player will be inserted here by IFrame API */}
            </div>
          </div>
        ) : (
        <video
          ref={videoRef}
          controls
          style={{
            width: '100%',
            height: 'auto',
            minHeight: '300px',
            display: 'block'
          }}
          preload="metadata"
        >
          <source src={videoUrl} type={getVideoType(videoUrl)} />
          Your browser does not support the video tag.
        </video>
        )}
      </div>

      {/* Video Speed Control */}
      <div style={{ 
        background: 'var(--bg-secondary)', 
        padding: '15px', 
        borderRadius: '8px',
        marginBottom: '15px',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>⚡</span>
            <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>Playback Speed:</strong>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {speedOptions.map((speed) => (
              <button
                key={speed}
                onClick={() => handleSpeedChange(speed)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: playbackSpeed === speed ? '2px solid #28a745' : '1px solid var(--border-color)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: playbackSpeed === speed ? 'bold' : 'normal',
                  background: playbackSpeed === speed 
                    ? 'linear-gradient(135deg, #28a745, #20c997)' 
                    : 'var(--bg-tertiary)',
                  color: '#fff',
                  transition: 'all 0.2s ease',
                  minWidth: '55px',
                  boxShadow: playbackSpeed === speed ? '0 2px 4px rgba(40, 167, 69, 0.3)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (playbackSpeed !== speed) {
                    e.target.style.background = 'var(--bg-secondary)';
                    e.target.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (playbackSpeed !== speed) {
                    e.target.style.background = 'var(--bg-tertiary)';
                    e.target.style.transform = 'translateY(0)';
                  }
                }}
                title={`Set playback speed to ${speed}x`}
              >
                {speed}x
              </button>
            ))}
          </div>
          <div style={{ 
            marginLeft: 'auto', 
            padding: '6px 12px', 
            background: 'var(--bg-tertiary)', 
            borderRadius: '6px',
            fontSize: '12px', 
            color: 'var(--text-secondary)'
          }}>
            Current: <strong style={{ color: '#28a745' }}>{playbackSpeed}x</strong>
          </div>
        </div>
      </div>

      {/* Load URL Section */}
      <div style={{ 
        background: 'var(--bg-secondary)', 
        padding: '20px', 
        borderRadius: '12px',
        marginBottom: '20px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px',
          marginBottom: '15px'
        }}>
          <span style={{ fontSize: '18px' }}>🔗</span>
          <strong style={{ color: 'var(--text-primary)', fontSize: '16px' }}>
            Load Video URL:
          </strong>
        </div>
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          alignItems: 'flex-start',
          flexWrap: 'wrap'
        }}>
          <input
            type="text"
            placeholder="Paste video URL (YouTube, MP4, etc.)"
            value={newVideoUrl}
            onChange={(e) => setNewVideoUrl(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && newVideoUrl.trim() && !isLoading) {
                loadNewVideo();
              }
            }}
            style={{ 
              flex: 1,
              minWidth: '250px',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '2px solid var(--border-color)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              transition: 'all 0.3s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--accent-color)';
              e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border-color)';
              e.target.style.boxShadow = 'none';
            }}
          />
          <button 
            onClick={loadNewVideo}
            disabled={!newVideoUrl.trim() || isLoading}
            className={newVideoUrl.trim() && !isLoading ? 'btn-info' : ''}
            style={{ 
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: newVideoUrl.trim() && !isLoading ? 'pointer' : 'not-allowed',
              opacity: newVideoUrl.trim() && !isLoading ? 1 : 0.6,
              transition: 'all 0.3s ease',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            title={isYouTubeUrl(newVideoUrl) ? 'Load YouTube video' : 'Load video from URL'}
          >
            {isLoading ? (
              <>⏳ Loading...</>
            ) : isYouTubeUrl(newVideoUrl) ? (
              <>📺 Load YouTube</>
            ) : (
              <>🌐 Load URL</>
            )}
          </button>
        </div>
        {isYouTubeUrl(newVideoUrl) && (
          <div style={{
            marginTop: '12px',
            padding: '10px 14px',
            background: 'linear-gradient(135deg, rgba(255, 0, 0, 0.15), rgba(204, 0, 0, 0.1))',
            border: '1px solid rgba(255, 0, 0, 0.3)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>📺</span>
            <span>YouTube video detected - will load in player</span>
          </div>
        )}
        {newVideoUrl.trim() && !isYouTubeUrl(newVideoUrl) && !newVideoUrl.startsWith('http') && (
          <div style={{
            marginTop: '12px',
            padding: '10px 14px',
            background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.15), rgba(255, 152, 0, 0.1))',
            border: '1px solid rgba(255, 193, 7, 0.3)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>⚠️</span>
            <span>Please enter a valid URL (e.g., https://example.com/video.mp4)</span>
          </div>
        )}
      </div>

      <div style={{ 
        background: 'var(--bg-secondary)', 
        padding: '20px', 
        borderRadius: '8px',
        marginBottom: '15px',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ marginBottom: '15px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '20px' }}>🎬</span>
            <strong style={{ color: 'var(--text-primary)', fontSize: '16px' }}>
              Now Playing:
            </strong>
            <span style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
              {videoTitle}
            </span>
          </div>
          {currentVideoFile && (
            <div style={{ 
              fontSize: '12px', 
              color: 'var(--text-muted)', 
              marginTop: '8px',
              padding: '6px 10px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
              display: 'inline-block'
            }}>
              📁 Local file: {(currentVideoFile.size / (1024 * 1024)).toFixed(1)} MB
            </div>
          )}
        </div>
        
        {/* Video Upload - Anyone Can Upload */}
        <div style={{ 
            marginBottom: '20px', 
            padding: '20px', 
            background: 'linear-gradient(135deg, rgba(40, 167, 69, 0.1), rgba(32, 201, 151, 0.05))',
            borderRadius: '16px', 
            border: '2px solid #28a745',
            boxShadow: '0 4px 12px rgba(40, 167, 69, 0.2)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '-30px',
              right: '-30px',
              width: '120px',
              height: '120px',
              background: 'radial-gradient(circle, rgba(40, 167, 69, 0.1) 0%, transparent 70%)',
              borderRadius: '50%'
            }}></div>
            <h4 style={{ 
              color: '#28a745', 
              marginBottom: '16px',
              fontSize: '18px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              position: 'relative',
              zIndex: 1
            }}>
              <span style={{ fontSize: '24px' }}>📁</span> Upload Video
            </h4>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
              disabled={isUploading}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-success"
              style={{ 
                marginBottom: '15px',
                padding: '14px 24px',
                fontSize: '15px',
                fontWeight: '700',
                width: '100%',
                position: 'relative',
                zIndex: 1
              }}
              disabled={isUploading || isLoading}
            >
              {isUploading ? '⏳ Uploading...' : '📁 Upload Video for Everyone'}
          </button>
            
            {isUploading && (
              <div style={{ marginTop: '15px', position: 'relative', zIndex: 1 }}>
                <div style={{ 
                  background: 'var(--bg-tertiary)', 
                  borderRadius: '12px', 
                  overflow: 'hidden',
                  height: '24px',
                  marginBottom: '8px',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)'
                }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #28a745, #20c997)',
                    height: '100%',
                    width: `${uploadProgress}%`,
                    transition: 'width 0.3s ease',
                    boxShadow: '0 2px 8px rgba(40, 167, 69, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: '8px',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>
                    {uploadProgress > 10 && `${uploadProgress}%`}
                  </div>
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ 
                    fontSize: '13px', 
                    color: 'var(--text-secondary)',
                    fontWeight: '500'
                  }}>
                    Uploading: <strong style={{ color: '#28a745' }}>{uploadProgress}%</strong>
                  </span>
                  <span style={{ 
                    fontSize: '12px', 
                    color: 'var(--text-muted)'
                  }}>
                    Please wait...
          </span>
        </div>
              </div>
            )}
            
            <div style={{ 
              fontSize: '13px', 
              color: 'var(--text-secondary)', 
              marginTop: '12px',
              padding: '10px',
              background: 'var(--bg-tertiary)',
              borderRadius: '8px',
              textAlign: 'center',
              position: 'relative',
              zIndex: 1
            }}>
              💡 Anyone can upload - everyone in the room gets access automatically! (max 1GB)
            </div>
            
            {hostVideo && (
              <div style={{ 
                marginTop: '15px', 
                padding: '14px', 
                background: 'linear-gradient(135deg, rgba(40, 167, 69, 0.15), rgba(32, 201, 151, 0.1))',
                borderRadius: '12px',
                border: '1px solid rgba(40, 167, 69, 0.3)',
                position: 'relative',
                zIndex: 1
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <span style={{ fontSize: '20px' }}>✅</span>
                  <strong style={{ color: '#28a745', fontSize: '15px' }}>
                    Uploaded: {hostVideo.title}
                  </strong>
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  <span>📦 Size: <strong>{(hostVideo.size / (1024 * 1024)).toFixed(1)} MB</strong></span>
                  {hostVideo.format && (
                    <span>🎬 Format: <strong>{hostVideo.format.toUpperCase()}</strong></span>
                  )}
                </div>
              </div>
            )}
            
            {/* Video Library */}
            {videoLibrary.length > 0 && (
              <div style={{ 
                marginTop: '20px', 
                padding: '18px', 
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)',
                position: 'relative',
                zIndex: 1
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: '12px' 
                }}>
                  <strong style={{ 
                    color: '#28a745',
                    fontSize: '16px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '20px' }}>📚</span> Video Library ({videoLibrary.length})
                  </strong>
                  <button
                    onClick={() => setShowLibrary(!showLibrary)}
                    className="btn-success"
                    style={{
                      padding: '6px 14px',
                      fontSize: '13px',
                      fontWeight: '600',
                      borderRadius: '8px'
                    }}
                  >
                    {showLibrary ? '▼ Hide' : '▶ Show'}
                  </button>
                </div>
                
                {showLibrary && (
                  <div style={{ 
                    maxHeight: '300px', 
                    overflowY: 'auto', 
                    marginTop: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    {videoLibrary.map((video, index) => (
                      <div
                        key={index}
                        onClick={() => selectVideoFromLibrary(video)}
                        style={{
                          padding: '14px 16px',
                          background: videoUrl === video.url 
                            ? 'linear-gradient(135deg, rgba(40, 167, 69, 0.2), rgba(32, 201, 151, 0.15))' 
                            : 'var(--bg-tertiary)',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          border: videoUrl === video.url 
                            ? '2px solid #28a745' 
                            : '1px solid var(--border-color)',
                          transition: 'all 0.3s ease',
                          boxShadow: videoUrl === video.url 
                            ? '0 4px 12px rgba(40, 167, 69, 0.3)' 
                            : 'var(--shadow-sm)',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          if (videoUrl !== video.url) {
                            e.currentTarget.style.background = 'var(--bg-secondary)';
                            e.currentTarget.style.transform = 'translateX(4px)';
                            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                            e.currentTarget.style.borderColor = '#28a745';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (videoUrl !== video.url) {
                            e.currentTarget.style.background = 'var(--bg-tertiary)';
                            e.currentTarget.style.transform = 'translateX(0)';
                            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                          }
                        }}
                      >
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          gap: '12px'
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px',
                              marginBottom: '6px'
                            }}>
                              {videoUrl === video.url && (
                                <span style={{ 
                                  fontSize: '16px',
                                  color: '#28a745',
                                  animation: 'pulse 2s infinite'
                                }}>▶</span>
                              )}
                              <strong style={{ 
                                fontSize: '14px',
                                color: videoUrl === video.url ? '#28a745' : 'var(--text-primary)',
                                fontWeight: '700'
                              }}>
                                {video.title}
                              </strong>
                            </div>
                            <div style={{ 
                              fontSize: '12px', 
                              color: 'var(--text-secondary)',
                              display: 'flex',
                              gap: '10px',
                              flexWrap: 'wrap',
                              alignItems: 'center'
                            }}>
                              <span style={{
                                padding: '2px 8px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: '6px',
                                fontWeight: '500'
                              }}>
                                📦 {(video.size / (1024 * 1024)).toFixed(1)} MB
                              </span>
                              {video.format && (
                                <span style={{
                                  padding: '2px 8px',
                                  background: 'var(--bg-tertiary)',
                                  borderRadius: '6px',
                                  fontWeight: '500'
                                }}>
                                  🎬 {video.format.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                          {videoUrl === video.url && (
                            <span style={{ 
                              fontSize: '12px', 
                              color: 'white',
                              background: 'linear-gradient(135deg, #28a745, #20c997)',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontWeight: '700',
                              boxShadow: '0 2px 8px rgba(40, 167, 69, 0.4)',
                              whiteSpace: 'nowrap'
                            }}>
                              Now Playing
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        {/* Current Video Info - Show for all users */}
        {hostVideo && (
          <div style={{ 
            marginBottom: '20px', 
            padding: '20px', 
            background: 'linear-gradient(135deg, rgba(0, 123, 255, 0.1), rgba(23, 162, 184, 0.05))',
            borderRadius: '16px', 
            border: '2px solid #007bff',
            boxShadow: '0 4px 12px rgba(0, 123, 255, 0.2)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '-30px',
              right: '-30px',
              width: '120px',
              height: '120px',
              background: 'radial-gradient(circle, rgba(0, 123, 255, 0.1) 0%, transparent 70%)',
              borderRadius: '50%'
            }}></div>
            <h4 style={{ 
              color: '#007bff', 
              marginBottom: '12px',
              fontSize: '18px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              position: 'relative',
              zIndex: 1
            }}>
              <span style={{ fontSize: '24px' }}>🎬</span> Current Video
            </h4>
            <div style={{ 
              marginTop: '15px', 
              padding: '14px', 
              background: 'linear-gradient(135deg, rgba(0, 123, 255, 0.15), rgba(23, 162, 184, 0.1))',
              borderRadius: '12px',
              border: '1px solid rgba(0, 123, 255, 0.3)',
              position: 'relative',
              zIndex: 1
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                marginBottom: '8px'
              }}>
                <span style={{ fontSize: '20px' }}>✅</span>
                <strong style={{ color: '#007bff', fontSize: '15px' }}>
                  {hostVideo.title}
                </strong>
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: 'var(--text-secondary)',
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <span>📦 Size: <strong>{(hostVideo.size / (1024 * 1024)).toFixed(1)} MB</strong></span>
                {hostVideo.format && (
                  <span>🎬 Format: <strong>{hostVideo.format.toUpperCase()}</strong></span>
                )}
                {hostVideo.uploadedBy && (
                  <span>👤 Uploaded by: <strong>{hostVideo.uploadedBy}</strong></span>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Local File Upload (Legacy - for testing only) */}
        <div style={{ marginBottom: '15px' }}>
            <details style={{ background: '#333', padding: '10px', borderRadius: '4px' }}>
              <summary style={{ cursor: 'pointer', color: '#ccc' }}>
                📁 Upload Local Video (Advanced)
              </summary>
              <div style={{ marginTop: '10px' }}>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileUpload}
                  style={{ marginBottom: '5px' }}
                />
                <div style={{ fontSize: '12px', color: '#ccc' }}>
                  Note: Local videos won't sync with other users. Use only for testing.
                </div>
              </div>
            </details>
          </div>

        {/* URL Input */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
          <input
            type="url"
            placeholder="Enter video URL or YouTube link..."
            value={newVideoUrl}
            onChange={(e) => setNewVideoUrl(e.target.value)}
            style={{ flex: 1 }}
            onKeyPress={(e) => e.key === 'Enter' && loadNewVideo()}
          />
          <button 
            onClick={loadNewVideo}
            disabled={!newVideoUrl.trim() || isLoading}
            className="btn-info"
          >
            {isLoading ? 'Loading...' : isYouTubeUrl(newVideoUrl) ? '📺 Load YouTube' : '🌐 Load URL'}
          </button>
        </div>
        
        {isYouTubeUrl(newVideoUrl) && (
          <div style={{
            background: 'linear-gradient(135deg, #ff0000, #cc0000)',
            color: 'white',
            padding: '10px 15px',
            borderRadius: '8px',
            marginBottom: '15px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>📺</span>
            <span>YouTube video detected! Paste any YouTube URL to watch together.</span>
          </div>
        )}

        {/* Sample Videos */}
        <div style={{ marginBottom: '15px' }}>
          <strong>🎯 Sample Videos:</strong>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
            {sampleVideos.map((sample, index) => (
              <button
                key={index}
                onClick={() => loadSampleVideo(sample)}
                style={{
                  background: videoUrl === sample.url ? '#28a745' : '#6c757d',
                  padding: '8px 12px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                {sample.title}
              </button>
            ))}
          </div>
        </div>
        
        <div style={{ 
          fontSize: '12px', 
          color: '#ccc',
          lineHeight: '1.4'
        }}>
          💡 <strong>Playback Control:</strong> 
          <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
            <li><strong>🎮 Anyone Can Control:</strong> Any user can play, pause, or seek - changes sync to everyone!</li>
            <li><strong>🔄 Auto-Sync:</strong> All playback actions are synchronized across all users</li>
            <li><strong>⏸️ Browser Auto-play:</strong> Browsers block auto-play - click the play button to start</li>
            <li><strong>🛡️ Sync Protection:</strong> Prevents sync loops with debouncing and progress flags</li>
            <li><strong>⚡ Force Sync:</strong> Manual sync trigger if videos get out of sync</li>
          </ul>
          
          <div style={{ marginTop: '10px', padding: '8px', background: '#007bff', borderRadius: '4px' }}>
            <strong>🎮 Tip:</strong> Click the play button on the video player to start watching. Anyone in the room can control playback!
          </div>
        </div>
      </div>
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;