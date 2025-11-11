import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { useNotifications } from './NotificationSystem';

const VideoPlayer = forwardRef(({ socket, roomId, currentUser, initialVideo, isHost, room }, ref) => {
  const { showNotification, NOTIFICATION_TYPES } = useNotifications();
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [hostVideo, setHostVideo] = useState(null);
  const [videoLibrary, setVideoLibrary] = useState([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showSpeedDropdown, setShowSpeedDropdown] = useState(false);
  const speedSyncInProgress = useRef(false);
  const [isYouTube, setIsYouTube] = useState(false);
  const [youtubeVideoId, setYoutubeVideoId] = useState(null);
  const youtubeSyncInProgress = useRef(false);
  const [isHLS, setIsHLS] = useState(false);
  const hlsRef = useRef(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [showMobilePlayPrompt, setShowMobilePlayPrompt] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [videoPaused, setVideoPaused] = useState(true);
  const autoplayAttemptedRef = useRef(false);
  
  // Detect Chrome and Brave browsers (they have stricter autoplay policies)
  const isChromeOrBrave = () => {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('chrome') || ua.includes('brave') || ua.includes('edg');
  };
  
  // Detect mobile device - check on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     (window.innerWidth <= 768 && 'ontouchstart' in window);
      setIsMobile(mobile);
      
      // If mobile and video is paused, show prompt immediately
      // Especially important for Chrome/Brave which have stricter policies
      if (mobile && videoRef.current && videoRef.current.paused) {
        setShowMobilePlayPrompt(true);
        setVideoPaused(true);
      }
      
      // For Chrome/Brave on mobile, always show prompt when video is paused
      if (mobile && isChromeOrBrave() && videoRef.current) {
        if (videoRef.current.paused) {
          setShowMobilePlayPrompt(true);
          setVideoPaused(true);
        }
      }
      
      return mobile;
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Detect mobile device function
  const isMobileDevice = () => {
    return isMobile || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.innerWidth <= 768 && 'ontouchstart' in window);
  };
  
  // Periodic check for mobile video state to ensure overlay shows
  // Especially important for Chrome/Brave browsers
  useEffect(() => {
    if (!isMobile || !videoRef.current) return;
    
    const checkVideoState = () => {
      if (videoRef.current) {
        const paused = videoRef.current.paused;
        if (paused !== videoPaused) {
          setVideoPaused(paused);
          if (paused) {
            setShowMobilePlayPrompt(true);
            // For Chrome/Brave, ensure prompt is always visible when paused
            if (isChromeOrBrave()) {
              setShowMobilePlayPrompt(true);
            }
          }
        }
      }
    };
    
    // Check more frequently for Chrome/Brave (every 300ms)
    const interval = setInterval(checkVideoState, isChromeOrBrave() ? 300 : 500);
    return () => clearInterval(interval);
  }, [isMobile, videoPaused]);
  
  // Refs to prevent sync loops
  const syncTimeoutRef = useRef(null);
  const lastEventTime = useRef(0);
  const ignoreNextEvent = useRef(false);
  const isHostRef = useRef(false);
  const syncInProgress = useRef(false);
  const videoInitialized = useRef(false);
  const lastSyncTimeRef = useRef(0);
  const youtubeSyncIntervalRef = useRef(null);
  const lastEventIdRef = useRef(0);
  
  // Touch/swipe gesture refs for mobile
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const isSwipeActive = useRef(false);
  const [swipeFeedback, setSwipeFeedback] = useState(null);

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

  // Check if current video URL is YouTube or HLS and update state
  useEffect(() => {
    const youtubeCheck = isYouTubeUrl(videoUrl);
    const hlsCheck = isHLSUrl(videoUrl);
    
    setIsYouTube(youtubeCheck);
    setIsHLS(hlsCheck);
    
    if (youtubeCheck) {
      const videoId = extractYouTubeId(videoUrl);
      setYoutubeVideoId(videoId);
      console.log('📺 YouTube video detected:', videoId);
    } else {
      setYoutubeVideoId(null);
    }
    
    if (hlsCheck) {
      console.log('📺 HLS stream detected:', videoUrl);
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
    if (video.src === videoUrl && !isHLS) {
      console.log('🎬 Video URL unchanged, skipping setup');
      return;
    }
    
    console.log('🎬 Setting up video with URL:', videoUrl);
    
    // Cleanup previous HLS instance if exists
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
        hlsRef.current = null;
      } catch (e) {
        console.warn('Error destroying HLS instance:', e);
      }
    }
    
    // Initialize HLS if it's an HLS stream
    if (isHLS && typeof window.Hls !== 'undefined') {
      console.log('📺 Initializing HLS.js for:', videoUrl);
      const hls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90
      });
      
      hls.loadSource(videoUrl);
      hls.attachMedia(video);
      
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        console.log('✅ HLS manifest parsed, ready to play');
        videoInitialized.current = true;
      });
      
      hls.on(window.Hls.Events.ERROR, (event, data) => {
        console.error('❌ HLS error:', data);
        if (data.fatal) {
          switch (data.type) {
            case window.Hls.ErrorTypes.NETWORK_ERROR:
              console.log('🔄 Fatal network error, trying to recover...');
              hls.startLoad();
              break;
            case window.Hls.ErrorTypes.MEDIA_ERROR:
              console.log('🔄 Fatal media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              console.log('❌ Fatal error, destroying HLS instance');
              hls.destroy();
              setPlayerError('HLS playback error');
              break;
          }
        }
      });
      
      hlsRef.current = hls;
    } else if (isHLS && typeof window.Hls === 'undefined') {
      console.error('❌ HLS.js library not loaded');
      setPlayerError('HLS.js library is required for HLS streams. Please refresh the page.');
    } else {
      // Set video source for regular videos
      video.src = videoUrl;
    }
    
    // Video event listeners with debouncing
    const handleLoadStart = () => {
      console.log('📥 Video loading started');
      setPlayerError('');
    };

    const handleLoadedData = () => {
      console.log('✅ Video data loaded');
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
    // Increased debounce times for better multi-user stability
    const handlePlay = () => {
      const now = Date.now();
      // Increased to 2000ms to prevent cascading events with multiple users (3-10 users)
      // Be less strict - don't require videoInitialized, just check readyState
      if (ignoreNextEvent.current || syncInProgress.current || now - lastEventTime.current < 2000) {
        ignoreNextEvent.current = false;
        return;
      }
      
      // Check if video is ready (be lenient)
      if (!video || video.readyState < 1) {
        console.log('⏳ Video not ready for user play, skipping...');
        return;
      }
      
      if (socket && roomId && !isSyncing) {
        const currentTime = video.currentTime;
        const eventId = ++lastEventIdRef.current;
        console.log(`🎬 User control: Emitting play at time: ${currentTime} (eventId: ${eventId})`);
        socket.emit('video_play', { 
          roomId, 
          currentTime, 
          initiatedBy: currentUser,
          eventId,
          timestamp: now
        });
        lastEventTime.current = now;
      }
    };

    const handlePause = () => {
      const now = Date.now();
      // Increased to 2000ms to prevent cascading events with multiple users (3-10 users)
      // Be less strict - don't require videoInitialized, just check readyState
      if (ignoreNextEvent.current || syncInProgress.current || now - lastEventTime.current < 2000) {
        ignoreNextEvent.current = false;
        return;
      }
      
      // Check if video is ready (be lenient)
      if (!video || video.readyState < 1) {
        console.log('⏳ Video not ready for user pause, skipping...');
        return;
      }
      
      if (socket && roomId && !isSyncing) {
        const currentTime = video.currentTime;
        const eventId = ++lastEventIdRef.current;
        console.log(`⏸️ User control: Emitting pause at time: ${currentTime} (eventId: ${eventId})`);
        socket.emit('video_pause', { 
          roomId, 
          currentTime, 
          initiatedBy: currentUser,
          eventId,
          timestamp: now
        });
        lastEventTime.current = now;
      }
    };

    const handleSeeked = () => {
      const now = Date.now();
      // Increased to 3000ms to prevent cascading events with multiple users (3-10 users)
      // Be less strict - don't require videoInitialized, just check readyState
      if (ignoreNextEvent.current || syncInProgress.current || now - lastEventTime.current < 3000) {
        ignoreNextEvent.current = false;
        return;
      }
      
      // Check if video is ready (be lenient)
      if (!video || video.readyState < 1) {
        console.log('⏳ Video not ready for user seek, skipping...');
        return;
      }
      
      if (socket && roomId && !isSyncing) {
        const currentTime = video.currentTime;
        const eventId = ++lastEventIdRef.current;
        console.log(`⏭️ User control: Emitting seek to time: ${currentTime} (eventId: ${eventId})`);
        socket.emit('video_seek', { 
          roomId, 
          currentTime, 
          initiatedBy: currentUser,
          eventId,
          timestamp: now
        });
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
      videoInitialized.current = true;
      
      // Set initial state if provided
      if (initialVideo) {
        video.currentTime = initialVideo.currentTime || 0;
        // Don't auto-play - browsers block it. User needs to click play button.
        // The video controls will handle play/pause
      }
      
      // For mobile users, if autoplay was attempted and video is paused, show prompt
      if (isMobileDevice() && autoplayAttemptedRef.current && video.paused) {
        setTimeout(() => {
          setShowMobilePlayPrompt(true);
          setAutoplayBlocked(true);
          setVideoPaused(true);
        }, 500); // Small delay to ensure video is fully ready
      }
      
      // For Chrome/Brave on mobile, always show prompt when video is paused
      if (isMobileDevice() && isChromeOrBrave() && video.paused) {
        setTimeout(() => {
          setShowMobilePlayPrompt(true);
          setVideoPaused(true);
        }, 300); // Shorter delay for Chrome/Brave
      }
      
      // Update paused state
      if (video.paused) {
        setVideoPaused(true);
        // For Chrome/Brave on mobile, show prompt immediately
        if (isMobileDevice() && isChromeOrBrave()) {
          setShowMobilePlayPrompt(true);
        }
      }
    };

    // Wait for video to be ready (skip for HLS as it handles its own ready event)
    if (!isHLS) {
      if (video.readyState >= 2) {
        handleVideoReady();
      } else {
        video.addEventListener('loadeddata', handleVideoReady, { once: true });
      }
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
      
      // Cleanup HLS instance
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
          hlsRef.current = null;
        } catch (e) {
          console.warn('Error destroying HLS instance on cleanup:', e);
        }
      }
    };
  }, [videoUrl, isHLS, currentUser, initialVideo, isSyncing, isYouTube, roomId, socket]); // Include all dependencies

  // Listen for socket events with improved logic
  useEffect(() => {
    if (!socket) return;

    // Update dependency to include isYouTube

    const handleVideoPlay = (data) => {
      // Handle YouTube player
      if (isYouTube && youtubePlayerRef.current) {
        const socketId = socket?.id;
        const isOwnEvent = data.initiatedBy === currentUser || data.socketId === socketId;
        
        // Check if we've already processed this event (by eventId or timestamp)
        const eventKey = `${data.eventId || data.timestamp || Date.now()}-${data.initiatedBy}`;
        if (lastSyncTimeRef.current === eventKey && !syncInProgress.current) {
          console.log('🚫 Ignoring duplicate YouTube play event:', eventKey);
          return;
        }
        
        // Skip periodic sync events from same user
        if (data.isPeriodicSync && isOwnEvent) {
          return;
        }
        
        if (isOwnEvent && !syncInProgress.current && !data.isPeriodicSync) {
          return;
        }
        
        // Store event key to prevent duplicate processing
        lastSyncTimeRef.current = eventKey;
        
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
      if (!videoRef.current) {
        console.warn('⚠️ Video ref not available, cannot sync play');
        return;
      }
      
      const video = videoRef.current;
      const socketId = socket?.id;
      
      // Check if video URL is set - if not, request sync state
      // Note: We allow the default sample video URL, but if it's still the default and we're in a room,
      // we should request the actual video state
      const isDefaultVideo = videoUrl === 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
      if (!videoUrl || (isDefaultVideo && roomId)) {
        console.log('⏳ Video URL not set or is default, requesting sync state...');
        if (socket && roomId) {
          socket.emit('request_video_state', { roomId });
        }
        // Don't process play event until we have the correct video URL
        // The sync state handler will handle setting the video and playing it
        return;
      }
      
      console.log('📥 PLAY EVENT RECEIVED:', { 
        initiatedBy: data.initiatedBy, 
        eventSocketId: data.socketId,
        currentUser, 
        mySocketId: socketId,
        matchInitiated: data.initiatedBy === currentUser,
        matchSocketId: data.socketId === socketId || data.initiatedBy === socketId,
        syncInProgress: syncInProgress.current,
        videoPaused: video.paused,
        videoUrl: videoUrl,
        videoReadyState: video.readyState
      });
      
      // Don't process if it's our own event (prevent loop)
      // Check both initiatedBy and socketId for maximum compatibility
      // Also check eventId to prevent duplicate processing
      const isOwnEvent = data.initiatedBy === currentUser || 
                        data.initiatedBy === socketId ||
                        data.socketId === socketId ||
                        data.socketId === currentUser;
      
      // Check if we've already processed this event (by eventId or timestamp)
      // Only check if we're not currently syncing (to allow retries during sync)
      const eventKey = `${data.eventId || data.timestamp || Date.now()}-${data.initiatedBy}`;
      if (lastSyncTimeRef.current === eventKey && !syncInProgress.current && video.readyState >= 2) {
        console.log('🚫 Ignoring duplicate play event:', eventKey);
        return;
      }
      
      if (isOwnEvent && !syncInProgress.current) {
        console.log('🚫 Ignoring own play event');
        return;
      }
      
      // Store event key to prevent duplicate processing
      lastSyncTimeRef.current = eventKey;
      
      console.log('🔄 Processing play sync from another user at time:', data.currentTime);
      
      // Set flags BEFORE playing to prevent loop
      syncInProgress.current = true;
      setIsSyncing(true);
      ignoreNextEvent.current = true;
      
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      try {
        // For HLS streams, ensure HLS instance is ready
        if (isHLS && hlsRef.current) {
          const hls = hlsRef.current;
          // Check if HLS is ready (manifest parsed)
          if (hls.media && hls.media.readyState >= 2) {
            console.log('✅ HLS ready, syncing play...');
            syncVideoPlay(video, data.currentTime);
          } else {
            console.log('⏳ HLS not ready, waiting for manifest...');
            // Wait for HLS to be ready
            const checkHLSReady = () => {
              if (hls.media && hls.media.readyState >= 2) {
                console.log('✅ HLS ready, now syncing...');
                syncVideoPlay(video, data.currentTime);
              } else {
                setTimeout(checkHLSReady, 100);
              }
            };
            // Also listen for manifest parsed event
            hls.once(window.Hls.Events.MANIFEST_PARSED, () => {
              console.log('✅ HLS manifest parsed, syncing play...');
              syncVideoPlay(video, data.currentTime);
            });
            checkHLSReady();
          }
          return;
        }
        
        // For regular videos, ensure video is loaded before syncing
        // Be less strict - only check readyState, not videoInitialized
        if (video.readyState < 2) {
          console.log('⏳ Video not ready (readyState:', video.readyState, '), waiting...');
          
          // Wait for video to be ready (with timeout)
          let waitCount = 0;
          const maxWait = 50; // Max 5 seconds (50 * 100ms)
          
          const waitForReady = () => {
            waitCount++;
            if (video.readyState >= 2) {
              console.log('✅ Video ready, now syncing...');
              syncVideoPlay(video, data.currentTime);
            } else if (waitCount < maxWait) {
              setTimeout(waitForReady, 100);
            } else {
              console.warn('⚠️ Video not ready after waiting, attempting sync anyway...');
              // Try to sync anyway - video might still work
              syncVideoPlay(video, data.currentTime);
            }
          };
          
          // Also listen for loadeddata event as backup
          const onLoadedData = () => {
            console.log('✅ Video loaded, now syncing...');
            syncVideoPlay(video, data.currentTime);
          };
          video.addEventListener('loadeddata', onLoadedData, { once: true });
          
          waitForReady();
          return;
        }
        
        syncVideoPlay(video, data.currentTime);
        
      } catch (error) {
        console.error('Error in sync play:', error);
      }

      // Reset sync flag after delay - increased for multi-user stability
      syncTimeoutRef.current = setTimeout(() => {
        setIsSyncing(false);
        syncInProgress.current = false;
        ignoreNextEvent.current = false; // Reset ignore flag
      }, 3000);
    };

    const syncVideoPlay = (video, targetTime) => {
      try {
        // Double-check video exists
        if (!video) {
          console.warn('⚠️ Video element not available');
          return;
        }
        
        // For HLS, check if HLS instance exists (but be lenient)
        if (isHLS) {
          if (!hlsRef.current) {
            console.warn('⚠️ HLS instance not available, waiting...');
            setTimeout(() => syncVideoPlay(video, targetTime), 200);
            return;
          }
          // For HLS, we can be more lenient - try to play even if not fully ready
        } else {
          // For regular videos, check readyState but be lenient
          if (video.readyState < 1) {
            console.warn('⚠️ Video not ready for sync play (readyState:', video.readyState, '), retrying...');
            setTimeout(() => syncVideoPlay(video, targetTime), 200);
            return;
          }
        }
        
        const timeDiff = Math.abs(video.currentTime - targetTime);
        
        // Only seek if there's a significant time difference
        if (timeDiff > 0.5) {
          console.log(`⏭️ Seeking from ${video.currentTime} to ${targetTime}`);
          video.currentTime = targetTime;
          
          // For HLS streams, wait a bit longer for buffering before playing
          if (isHLS && hlsRef.current) {
            // HLS streams need time to buffer the segment
            setTimeout(() => {
              if (!video.paused) {
                console.log('✅ Video already playing after seek');
                return; // Already playing
              }
              console.log('▶️ Starting HLS playback after seek...');
              video.play().catch(err => {
                if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
                  console.error('HLS sync play failed:', err);
                } else if (err.name === 'NotAllowedError') {
                  console.log('ℹ️ Autoplay blocked - user interaction required');
                  setAutoplayBlocked(true);
                  if (isMobileDevice()) {
                    setShowMobilePlayPrompt(true);
                    autoplayAttemptedRef.current = true;
                  }
                }
              });
            }, 300); // Increased delay for HLS buffering
            return; // Exit early, play will happen in setTimeout
          }
          
          // For regular videos, wait a moment for seek to complete
          setTimeout(() => {
            if (video.paused) {
              console.log('▶️ Starting playback after seek...');
              video.play().catch(err => {
                if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
                  console.error('Sync play failed:', err);
                } else if (err.name === 'NotAllowedError') {
                  console.log('ℹ️ Autoplay blocked - user interaction required');
                  setAutoplayBlocked(true);
                  if (isMobileDevice()) {
                    setShowMobilePlayPrompt(true);
                    autoplayAttemptedRef.current = true;
                  }
                }
              });
            }
          }, 100);
          return;
        }
        
        // No seek needed, just play if paused
        if (video.paused) {
          console.log('▶️ Starting playback (no seek needed)...');
          // Try to play - if it fails due to browser restrictions, that's okay
          video.play().catch(err => {
            if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
              console.error('Sync play failed:', err);
            } else if (err.name === 'NotAllowedError') {
              console.log('ℹ️ Autoplay blocked - user interaction required');
              setAutoplayBlocked(true);
              // Show mobile play prompt if on mobile
              if (isMobileDevice()) {
                setShowMobilePlayPrompt(true);
                autoplayAttemptedRef.current = true;
              }
            }
            // NotAllowedError is expected for autoplay - user will need to click play
          });
        } else {
          console.log('✅ Video already playing');
          setAutoplayBlocked(false);
          setShowMobilePlayPrompt(false);
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
        
        // Check if we've already processed this event (by eventId or timestamp)
        const eventKey = `${data.eventId || data.timestamp || Date.now()}-${data.initiatedBy}`;
        if (lastSyncTimeRef.current === eventKey && !syncInProgress.current) {
          console.log('🚫 Ignoring duplicate YouTube pause event:', eventKey);
          return;
        }
        
        if (isOwnEvent && !syncInProgress.current) {
          return;
        }
        
        // Store event key to prevent duplicate processing
        lastSyncTimeRef.current = eventKey;
        
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
          
          // Increased timeout for multi-user stability
          setTimeout(() => {
            youtubeSyncInProgress.current = false;
            syncInProgress.current = false;
            setIsSyncing(false);
          }, 1000);
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
      // Also check eventId to prevent duplicate processing
      const isOwnEvent = data.initiatedBy === currentUser || 
                        data.initiatedBy === socketId ||
                        data.socketId === socketId ||
                        data.socketId === currentUser;
      
      // Check if we've already processed this event (by eventId or timestamp)
      const eventKey = `${data.eventId || data.timestamp || Date.now()}-${data.initiatedBy}`;
      if (lastSyncTimeRef.current === eventKey && !syncInProgress.current) {
        console.log('🚫 Ignoring duplicate pause event:', eventKey);
        return;
      }
      
      if (isOwnEvent && !syncInProgress.current) {
        console.log('🚫 Ignoring own pause event');
        return;
      }
      
      // Store event key to prevent duplicate processing
      lastSyncTimeRef.current = eventKey;
      
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

      // Reset sync flags after delay - increased for multi-user stability
      syncTimeoutRef.current = setTimeout(() => {
        console.log('🔄 Resetting sync flags');
        setIsSyncing(false);
        syncInProgress.current = false;
        ignoreNextEvent.current = false; // Reset ignore flag
      }, 3000);
    };

    const handleVideoSeek = (data) => {
      // Check if we've already processed this event (by eventId or timestamp)
      const eventKey = `${data.eventId || data.timestamp || Date.now()}-${data.initiatedBy}`;
      if (lastSyncTimeRef.current === eventKey && !syncInProgress.current) {
        console.log('🚫 Ignoring duplicate seek event:', eventKey);
        return;
      }
      
      const socketId = socket?.id;
      const isOwnEvent = data.initiatedBy === currentUser || 
                        data.initiatedBy === socketId ||
                        data.socketId === socketId ||
                        data.socketId === currentUser;
      
      if (isOwnEvent && !syncInProgress.current) {
        console.log('🚫 Ignoring own seek event');
        return;
      }
      
      if (syncInProgress.current) {
        console.log('🚫 Ignoring seek event - sync in progress');
        return;
      }
      
      // Store event key to prevent duplicate processing
      lastSyncTimeRef.current = eventKey;
      
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
        
        // For HLS streams, ensure proper buffering after seek
        if (isHLS && hlsRef.current) {
          // HLS might need a moment to load the segment at the new position
          // The video element will handle this, but we can wait a bit
          setTimeout(() => {
            // Verify the seek completed
            const actualTime = video.currentTime;
            const timeDiff = Math.abs(actualTime - data.currentTime);
            if (timeDiff > 1) {
              console.log(`⚠️ HLS seek may not have completed. Expected: ${data.currentTime}, Actual: ${actualTime}`);
            }
          }, 300);
        }
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
      
      // Blob URLs can't be shared - skip them
      if (data.videoUrl.startsWith('blob:') || data.isBlobUrl) {
        return;
      }
      
      setVideoUrl(data.videoUrl);
      setVideoTitle(data.videoTitle || 'Remote Video');
      
      // Show notification
      showNotification({
        type: NOTIFICATION_TYPES.INFO,
        title: 'Video Changed',
        message: `${data.initiatedBy || 'Someone'} changed the video to: ${data.videoTitle || 'New Video'}`,
        icon: '🎬',
        key: 'videoChanged',
        duration: 4000
      });
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
      
      // Show notification to other users
      if (data.uploadedBy !== currentUser) {
        showNotification({
          type: NOTIFICATION_TYPES.SUCCESS,
          title: 'Video Uploaded',
          message: `${data.uploadedBy || 'Someone'} uploaded: ${data.videoTitle}`,
          icon: '📁',
          key: 'videoUploaded',
          duration: 5000
        });
      } else {
        // Show success notification to the uploader
        showNotification({
          type: NOTIFICATION_TYPES.SUCCESS,
          title: 'Upload Successful',
          message: `Video "${data.videoTitle}" uploaded successfully!`,
          icon: '✅',
          key: 'videoUploaded',
          duration: 4000
        });
      }
    };

    const handleVideoSelected = (data) => {
      console.log('🎬 User selected video:', data);
      
      setVideoUrl(data.videoUrl);
      setVideoTitle(data.videoTitle);
      setHostVideo(data);
      setCurrentVideoFile(null);
      setPlayerError('');
      
      if (data.selectedBy !== currentUser) {
        showNotification({
          type: NOTIFICATION_TYPES.INFO,
          title: 'Video Changed',
          message: `${data.selectedBy || 'Someone'} selected: ${data.videoTitle}`,
          icon: '🎬',
          key: 'videoChanged',
          duration: 4000
        });
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

    const handleVideoSyncState = (data) => {
      console.log('🔄 Received video sync state:', data);
      
      // Only sync if it's from server or another user (not our own action)
      if (data.initiatedBy === currentUser || data.initiatedBy === socket?.id) {
        console.log('🚫 Ignoring own sync state');
        return;
      }
      
      // Set sync flags to prevent loops
      syncInProgress.current = true;
      setIsSyncing(true);
      ignoreNextEvent.current = true;
      
      // Update video URL if different
      if (data.videoUrl && data.videoUrl !== videoUrl) {
        console.log('📺 Syncing video URL:', data.videoUrl);
        setVideoUrl(data.videoUrl);
        setVideoTitle(data.videoTitle || 'Video');
      }
      
      // For mobile users joining when video is already playing, show prompt
      if (data.isPlaying && isMobileDevice() && data.isInitialSync) {
        // Set a flag to show prompt after video loads
        autoplayAttemptedRef.current = true;
        // Also set mobile state to ensure prompt shows
        setIsMobile(true);
        // For Chrome/Brave, always show prompt on initial sync
        if (isChromeOrBrave()) {
          setShowMobilePlayPrompt(true);
        }
      }
      
      // For mobile users, always show prompt when video is paused
      // Especially important for Chrome/Brave
      if (isMobileDevice() && !data.isPlaying) {
        setIsMobile(true);
        setVideoPaused(true);
        setShowMobilePlayPrompt(true);
        // For Chrome/Brave, ensure prompt is visible
        if (isChromeOrBrave()) {
          setShowMobilePlayPrompt(true);
        }
      }
      
      // Wait for video to be ready, then sync
      const syncToState = () => {
        if (isYouTube && youtubePlayerRef.current) {
          try {
            const targetTime = data.currentTime || 0;
            youtubePlayerRef.current.seekTo(targetTime, true);
            setTimeout(() => {
              if (data.isPlaying) {
                youtubePlayerRef.current.playVideo();
              } else {
                youtubePlayerRef.current.pauseVideo();
              }
              if (data.playbackSpeed) {
                youtubePlayerRef.current.setPlaybackRate(data.playbackSpeed);
              }
            }, 100);
          } catch (error) {
            console.error('Error syncing YouTube state:', error);
          }
        } else if (videoRef.current) {
          const video = videoRef.current;
          
          // For HLS streams, wait for HLS to be ready
          if (isHLS && hlsRef.current) {
            const hls = hlsRef.current;
            const applyHLSState = () => {
              if (hls.media && hls.media.readyState >= 2) {
                const targetTime = data.currentTime || 0;
                const timeDiff = Math.abs(video.currentTime - targetTime);
                
                if (timeDiff > 0.5) {
                  video.currentTime = targetTime;
                }
                
                setTimeout(() => {
                  if (data.isPlaying && video.paused) {
                    video.play().catch(err => {
                      if (err.name === 'NotAllowedError') {
                        console.log('ℹ️ Autoplay blocked on mobile - user interaction required');
                        setAutoplayBlocked(true);
                        if (isMobileDevice()) {
                          setShowMobilePlayPrompt(true);
                          autoplayAttemptedRef.current = true;
                        }
                      } else {
                        console.error('HLS play error:', err);
                      }
                    });
                  } else if (!data.isPlaying && !video.paused) {
                    video.pause();
                  }
                  
                  if (data.playbackSpeed) {
                    video.playbackRate = data.playbackSpeed;
                    setPlaybackSpeed(data.playbackSpeed);
                  }
                }, 200);
              } else {
                // Wait for HLS to be ready
                setTimeout(applyHLSState, 100);
              }
            };
            
            // Listen for manifest parsed if not ready
            if (hls.media && hls.media.readyState < 2) {
              hls.once(window.Hls.Events.MANIFEST_PARSED, applyHLSState);
            }
            applyHLSState();
            return;
          }
          
          // For regular videos
          if (video.readyState >= 2 && videoInitialized.current) {
            const targetTime = data.currentTime || 0;
            const timeDiff = Math.abs(video.currentTime - targetTime);
            
            if (timeDiff > 0.5) {
              video.currentTime = targetTime;
            }
            
            setTimeout(() => {
              if (data.isPlaying && video.paused) {
                video.play().catch(err => {
                  if (err.name === 'NotAllowedError') {
                    console.log('ℹ️ Autoplay blocked on mobile - user interaction required');
                    setAutoplayBlocked(true);
                    if (isMobileDevice()) {
                      setShowMobilePlayPrompt(true);
                      autoplayAttemptedRef.current = true;
                    }
                  } else {
                    console.error('Play error:', err);
                  }
                });
              } else if (!data.isPlaying && !video.paused) {
                video.pause();
              }
              
              if (data.playbackSpeed) {
                video.playbackRate = data.playbackSpeed;
                setPlaybackSpeed(data.playbackSpeed);
              }
            }, 100);
          } else {
            // Wait for video to load
            const applyState = () => {
              if (video.readyState >= 2 && videoInitialized.current) {
                video.currentTime = data.currentTime || 0;
                setTimeout(() => {
                  if (data.isPlaying) {
                    video.play().catch(err => {
                      if (err.name === 'NotAllowedError') {
                        console.log('ℹ️ Autoplay blocked on mobile - user interaction required');
                        setAutoplayBlocked(true);
                        if (isMobileDevice()) {
                          setShowMobilePlayPrompt(true);
                          autoplayAttemptedRef.current = true;
                        }
                      } else {
                        console.error('Play error:', err);
                      }
                    });
                  }
                  if (data.playbackSpeed) {
                    video.playbackRate = data.playbackSpeed;
                    setPlaybackSpeed(data.playbackSpeed);
                  }
                }, 100);
              } else {
                setTimeout(applyState, 100);
              }
            };
            
            video.addEventListener('loadeddata', applyState, { once: true });
            applyState();
          }
        }
        
        // Reset sync flags
        setTimeout(() => {
          syncInProgress.current = false;
          setIsSyncing(false);
          ignoreNextEvent.current = false;
        }, 1000);
      };
      
      // Delay sync slightly to ensure video is ready
      setTimeout(syncToState, data.isInitialSync ? 1500 : 300);
    };

    socket.on('video_play', handleVideoPlay);
    socket.on('video_pause', handleVideoPause);
    socket.on('video_seek', handleVideoSeek);
    socket.on('video_url_change', handleVideoUrlChange);
    socket.on('video_uploaded', handleVideoUploaded);
    socket.on('host_video_uploaded', handleVideoUploaded); // Keep for backward compatibility
    socket.on('video_selected', handleVideoSelected);
    socket.on('video_speed_change', handleVideoSpeedChange);
    socket.on('video_sync_state', handleVideoSyncState);

    // Request current state when joining room
    if (roomId && socket) {
      setTimeout(() => {
        socket.emit('request_video_state', { roomId });
      }, 2000);
    }

    return () => {
      socket.off('video_play', handleVideoPlay);
      socket.off('video_pause', handleVideoPause);
      socket.off('video_seek', handleVideoSeek);
      socket.off('video_url_change', handleVideoUrlChange);
      socket.off('video_uploaded', handleVideoUploaded);
      socket.off('host_video_uploaded', handleVideoUploaded);
      socket.off('video_selected', handleVideoSelected);
      socket.off('video_speed_change', handleVideoSpeedChange);
      socket.off('video_sync_state', handleVideoSyncState);
    };
  }, [socket, currentUser, isYouTube, roomId, videoUrl, isHLS, showNotification]);

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
    // Detect video format from URL or file extension
    const urlLower = url.toLowerCase();
    if (urlLower.includes('.m3u8') || urlLower.includes('application/vnd.apple.mpegurl')) {
      return 'application/vnd.apple.mpegurl'; // HLS MIME type
    }
    if (urlLower.includes('.mp4') || urlLower.includes('video/mp4')) return 'video/mp4';
    if (urlLower.includes('.webm') || urlLower.includes('video/webm')) return 'video/webm';
    if (urlLower.includes('.ogg') || urlLower.includes('video/ogg') || urlLower.includes('.ogv')) return 'video/ogg';
    if (urlLower.includes('.mov') || urlLower.includes('video/quicktime')) return 'video/quicktime';
    if (urlLower.includes('.avi') || urlLower.includes('video/x-msvideo')) return 'video/x-msvideo';
    if (urlLower.includes('.mkv') || urlLower.includes('video/x-matroska')) return 'video/x-matroska';
    if (urlLower.includes('.m4v')) return 'video/mp4';
    if (urlLower.includes('.flv')) return 'video/x-flv';
    // Default to mp4 for best compatibility
    return 'video/mp4';
  };
  
  const getSupportedFormats = () => {
    // Check browser support for different formats
    const video = document.createElement('video');
    const formats = {
      mp4: video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"') !== '',
      webm: video.canPlayType('video/webm; codecs="vp8, vorbis"') !== '',
      ogg: video.canPlayType('video/ogg; codecs="theora, vorbis"') !== '',
      mov: video.canPlayType('video/quicktime') !== ''
    };
    return formats;
  };

  // Check if URL is a YouTube URL
  const isYouTubeUrl = (url) => {
    if (!url) return false;
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return youtubeRegex.test(url);
  };

  // Check if URL is an HLS stream
  const isHLSUrl = (url) => {
    if (!url) return false;
    const urlLower = url.toLowerCase();
    return urlLower.includes('.m3u8') || urlLower.includes('application/vnd.apple.mpegurl');
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
      alert('Please select a video file (MP4, WebM, MOV, AVI, MKV, etc.)');
      return;
    }

    const maxSize = 1024 * 1024 * 1024; // 1GB limit
    if (file.size > maxSize) {
      alert('File is too large. Please select a video smaller than 1GB.');
      return;
    }

    // Check format support and warn if needed
    const formats = getSupportedFormats();
    const fileName = file.name.toLowerCase();
    
    let formatWarning = '';
    if (fileName.includes('.mp4') || fileName.includes('.m4v')) {
      if (!formats.mp4) {
        formatWarning = '⚠️ MP4 format may not be fully supported in this browser. Consider using WebM or OGG.';
      }
    } else if (fileName.includes('.webm')) {
      if (!formats.webm) {
        formatWarning = '⚠️ WebM format may not be fully supported in this browser. Consider using MP4 for best compatibility.';
      }
    } else if (fileName.includes('.mov')) {
      if (!formats.mov) {
        formatWarning = '⚠️ MOV format has limited browser support. Consider converting to MP4 for best compatibility.';
      }
    } else if (fileName.includes('.avi') || fileName.includes('.mkv')) {
      formatWarning = '⚠️ AVI/MKV formats have limited HTML5 support. The video may not play in all browsers. Consider converting to MP4 for best compatibility.';
    }
    
    if (formatWarning) {
      const proceed = window.confirm(`${formatWarning}\n\nDo you want to continue uploading anyway?`);
      if (!proceed) {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
    }

    // Upload to server - one user uploads, everyone can stream
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

  const extractVideoTitle = (url) => {
    try {
      const urlObj = new URL(url);
      const filename = urlObj.pathname.split('/').pop();
      return filename || 'Custom Video';
    } catch {
      return 'Custom Video';
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
  }, [videoUrl]);

  // Touch gesture handlers for mobile video controls
  const handleTouchStart = (e) => {
    if (isYouTube) return; // Don't handle gestures for YouTube videos
    
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    touchStartTime.current = Date.now();
    isSwipeActive.current = false;
  };

  const handleTouchMove = (e) => {
    if (isYouTube || !videoRef.current) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    
    // Determine if this is a horizontal (seek) or vertical (volume) swipe
    if (Math.abs(deltaX) > 30 || Math.abs(deltaY) > 30) {
      isSwipeActive.current = true;
      
      // Horizontal swipe for seeking
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        e.preventDefault();
        const video = videoRef.current;
        if (video && video.duration) {
          const seekAmount = (deltaX / window.innerWidth) * video.duration;
          const newTime = Math.max(0, Math.min(video.duration, video.currentTime + seekAmount));
          
          // Show feedback
          const seconds = Math.floor(Math.abs(seekAmount));
          setSwipeFeedback({
            type: 'seek',
            direction: deltaX > 0 ? 'forward' : 'backward',
            seconds,
            time: formatTime(newTime)
          });
        }
      }
      // Vertical swipe for volume
      else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 50) {
        e.preventDefault();
        const video = videoRef.current;
        if (video) {
          const volumeChange = -deltaY / window.innerHeight;
          const newVolume = Math.max(0, Math.min(1, video.volume + volumeChange));
          video.volume = newVolume;
          
          // Show feedback
          setSwipeFeedback({
            type: 'volume',
            direction: deltaY > 0 ? 'down' : 'up',
            volume: Math.round(newVolume * 100)
          });
        }
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (isYouTube || !videoRef.current || !isSwipeActive.current) {
      isSwipeActive.current = false;
      setSwipeFeedback(null);
      return;
    }
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    const video = videoRef.current;
    
    // Apply the final seek if it was a horizontal swipe
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50 && video.duration) {
      const seekAmount = (deltaX / window.innerWidth) * video.duration;
      const newTime = Math.max(0, Math.min(video.duration, video.currentTime + seekAmount));
      video.currentTime = newTime;
      
      // Emit seek event
      if (socket && roomId && !syncInProgress.current) {
        socket.emit('video_seek', { roomId, currentTime: newTime, initiatedBy: currentUser });
      }
    }
    
    // Clear feedback after a delay
    setTimeout(() => {
      setSwipeFeedback(null);
    }, 1000);
    
    isSwipeActive.current = false;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSpeedDropdown && !event.target.closest('[data-speed-control]')) {
        setShowSpeedDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSpeedDropdown]);

  return (
    <div className="component-card" style={{ marginBottom: 0 }}>
      <h3 style={{ marginBottom: '20px', fontSize: '22px', fontWeight: '800' }}>🎬 Video Player - Everyone Can Control!</h3>
      
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
            onClick={resetSync}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              background: '#6f42c1',
              minHeight: '44px',
              minWidth: '60px',
              touchAction: 'manipulation'
            }}
            className="touch-friendly"
          >
            🔄 Reset Sync
          </button>

          <button 
            onClick={forceSync}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              background: '#fd7e14',
              minHeight: '44px',
              minWidth: '60px',
              touchAction: 'manipulation'
            }}
            className="touch-friendly"
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
              padding: '8px 16px',
              fontSize: '14px',
              background: '#20c997',
              minHeight: '44px',
              minWidth: '60px',
              touchAction: 'manipulation'
            }}
            className="touch-friendly"
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
        transition: 'all 0.3s ease',
        touchAction: 'pan-y pinch-zoom'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 12px 32px rgba(40, 167, 69, 0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(40, 167, 69, 0.3)';
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      >
        {/* Swipe Feedback Overlay */}
        {swipeFeedback && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0, 0, 0, 0.85)',
            color: 'white',
            padding: '20px 30px',
            borderRadius: '16px',
            fontSize: '24px',
            fontWeight: 'bold',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            pointerEvents: 'none',
            minWidth: '120px'
          }}>
            {swipeFeedback.type === 'seek' && (
              <>
                <div style={{ fontSize: '32px' }}>
                  {swipeFeedback.direction === 'forward' ? '⏩' : '⏪'}
                </div>
                <div>{swipeFeedback.seconds}s</div>
                <div style={{ fontSize: '16px', opacity: 0.8 }}>{swipeFeedback.time}</div>
              </>
            )}
            {swipeFeedback.type === 'volume' && (
              <>
                <div style={{ fontSize: '32px' }}>
                  {swipeFeedback.direction === 'up' ? '🔊' : '🔉'}
                </div>
                <div>{swipeFeedback.volume}%</div>
              </>
            )}
          </div>
        )}
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
        <div style={{ position: 'relative', width: '100%' }}>
          <video
            ref={videoRef}
            controls
            controlsList="nodownload"
            playsInline
            muted={false}
            style={{
              width: '100%',
              height: 'auto',
              minHeight: '300px',
              display: 'block',
              touchAction: 'pan-y pinch-zoom',
              // Ensure controls are always visible on mobile
              WebkitAppearance: 'none',
              appearance: 'none',
              // For Chrome/Brave, ensure video is interactive
              pointerEvents: 'auto'
            }}
            preload="metadata"
            onPlay={() => {
              setAutoplayBlocked(false);
              setShowMobilePlayPrompt(false);
              setVideoPaused(false);
            }}
            onPause={() => {
              setVideoPaused(true);
              // On mobile, show prompt when video is paused
              if (isMobileDevice()) {
                // Small delay to avoid showing immediately after user pause
                setTimeout(() => {
                  if (videoRef.current && videoRef.current.paused) {
                    setShowMobilePlayPrompt(true);
                  }
                }, 500);
              }
            }}
            onLoadedMetadata={() => {
              // Update paused state when video metadata loads
              if (videoRef.current) {
                setVideoPaused(videoRef.current.paused);
                // For Chrome/Brave on mobile, show prompt immediately when metadata loads
                if (isMobileDevice() && isChromeOrBrave() && videoRef.current.paused) {
                  setTimeout(() => {
                    setShowMobilePlayPrompt(true);
                  }, 200);
                }
              }
            }}
            onCanPlay={() => {
              // For Chrome/Brave on mobile, ensure prompt shows when video can play
              if (isMobileDevice() && isChromeOrBrave() && videoRef.current && videoRef.current.paused) {
                setShowMobilePlayPrompt(true);
                setVideoPaused(true);
              }
            }}
            onClick={(e) => {
              // User interaction detected - try to play if blocked
              // For Chrome/Brave, this is critical for autoplay
              if (videoRef.current && videoRef.current.paused) {
                const playPromise = videoRef.current.play();
                if (playPromise !== undefined) {
                  playPromise.then(() => {
                    setAutoplayBlocked(false);
                    setShowMobilePlayPrompt(false);
                    setVideoPaused(false);
                  }).catch(err => {
                    console.error('Manual play failed:', err);
                    if (err.name === 'NotAllowedError') {
                      // Chrome/Brave blocked autoplay - show prompt
                      if (isMobileDevice() && isChromeOrBrave()) {
                        setShowMobilePlayPrompt(true);
                        setAutoplayBlocked(true);
                      }
                    }
                  });
                }
              }
            }}
            onTouchStart={(e) => {
              // For Chrome/Brave, register touch as user interaction
              if (isChromeOrBrave() && videoRef.current && videoRef.current.paused) {
                // Touch on video element itself can help unlock autoplay
                // Don't prevent default - let it bubble to video controls
              }
            }}
          >
            <source src={videoUrl} type={getVideoType(videoUrl)} />
            Your browser does not support the video tag.
          </video>
          
          {/* Mobile Play Prompt Overlay - Show when video is paused on mobile */}
          {/* Always show for Chrome/Brave on mobile when paused */}
          {isMobile && videoPaused && showMobilePlayPrompt && videoRef.current && (
            <div
              onTouchStart={(e) => {
                e.stopPropagation();
                // For Chrome/Brave, we need to be more careful with preventDefault
                // Only prevent if it's not a video control interaction
                if (!e.target.closest('video')) {
                  e.preventDefault();
                }
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                // Don't prevent default on touchEnd for Chrome/Brave - let it bubble
                const handlePlay = () => {
                  if (videoRef.current) {
                    // Use a small delay for Chrome/Brave to ensure user interaction is registered
                    const playPromise = videoRef.current.play();
                    if (playPromise !== undefined) {
                      playPromise.then(() => {
                        setShowMobilePlayPrompt(false);
                        setAutoplayBlocked(false);
                        setVideoPaused(false);
                      }).catch(err => {
                        console.error('Play failed:', err);
                        // Still show the prompt if play fails
                        setShowMobilePlayPrompt(true);
                      });
                    }
                  }
                };
                
                // For Chrome/Brave, use immediate execution
                if (isChromeOrBrave()) {
                  handlePlay();
                } else {
                  e.preventDefault();
                  handlePlay();
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (videoRef.current) {
                  // For Chrome/Brave, ensure play is called directly from user interaction
                  const playPromise = videoRef.current.play();
                  if (playPromise !== undefined) {
                    playPromise.then(() => {
                      setShowMobilePlayPrompt(false);
                      setAutoplayBlocked(false);
                      setVideoPaused(false);
                    }).catch(err => {
                      console.error('Play failed:', err);
                      setShowMobilePlayPrompt(true);
                    });
                  }
                }
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.9)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                cursor: 'pointer',
                borderRadius: '8px',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <div style={{
                textAlign: 'center',
                padding: '20px',
                color: '#fff'
              }}>
                <div style={{
                  fontSize: '64px',
                  marginBottom: '20px',
                  animation: 'pulse 2s infinite'
                }}>
                  ▶️
                </div>
                <div style={{
                  fontSize: '22px',
                  fontWeight: 'bold',
                  marginBottom: '12px',
                  color: '#fff'
                }}>
                  Tap to Play Video
                </div>
                <div style={{
                  fontSize: '16px',
                  color: '#ccc',
                  marginTop: '8px',
                  textAlign: 'center',
                  padding: '0 20px'
                }}>
                  Mobile browsers require user interaction to play videos
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#fff',
                  marginTop: '20px',
                  padding: '12px 20px',
                  background: 'rgba(0, 123, 255, 0.3)',
                  borderRadius: '8px',
                  border: '2px solid rgba(0, 123, 255, 0.5)'
                }}>
                  💡 Tap anywhere on this screen to start playback
                </div>
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Video Speed Control & Load URL */}
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '15px',
        flexWrap: 'wrap'
      }}>
        {/* Playback Speed Button */}
        <div data-speed-control style={{ 
          display: 'inline-block',
          position: 'relative'
        }}>
          <button
            onClick={() => setShowSpeedDropdown(!showSpeedDropdown)}
            className="touch-friendly"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              transition: 'all 0.2s ease',
              minHeight: '36px',
              touchAction: 'manipulation'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'var(--bg-secondary)';
              e.target.style.borderColor = 'var(--accent-color)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'var(--bg-tertiary)';
              e.target.style.borderColor = 'var(--border-color)';
            }}
          >
            <span style={{ fontSize: '14px' }}>⚡</span>
            <span>{playbackSpeed}x</span>
            <span style={{ fontSize: '10px', opacity: 0.7 }}>{showSpeedDropdown ? '▲' : '▼'}</span>
          </button>

        {showSpeedDropdown && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '6px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '6px',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '4px',
            minWidth: '180px'
          }}>
            {speedOptions.map((speed) => (
              <button
                key={speed}
                onClick={() => {
                  handleSpeedChange(speed);
                  setShowSpeedDropdown(false);
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: playbackSpeed === speed ? '2px solid #28a745' : '1px solid var(--border-color)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: playbackSpeed === speed ? 'bold' : 'normal',
                  background: playbackSpeed === speed 
                    ? 'linear-gradient(135deg, #28a745, #20c997)' 
                    : 'var(--bg-tertiary)',
                  color: playbackSpeed === speed ? '#fff' : 'var(--text-primary)',
                  transition: 'all 0.2s ease',
                  minHeight: '36px',
                  touchAction: 'manipulation'
                }}
                className="touch-friendly"
                onMouseEnter={(e) => {
                  if (playbackSpeed !== speed) {
                    e.target.style.background = 'var(--bg-secondary)';
                    e.target.style.borderColor = 'var(--accent-color)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (playbackSpeed !== speed) {
                    e.target.style.background = 'var(--bg-tertiary)';
                    e.target.style.borderColor = 'var(--border-color)';
                  }
                }}
                title={`Set playback speed to ${speed}x`}
              >
                {speed}x
              </button>
            ))}
          </div>
        )}
        </div>

        {/* Load URL Button */}
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flex: 1,
          minWidth: '200px'
        }}>
          <input
            type="text"
            placeholder="Paste video URL..."
            value={newVideoUrl}
            onChange={(e) => setNewVideoUrl(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && newVideoUrl.trim() && !isLoading) {
                loadNewVideo();
              }
            }}
            style={{ 
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              transition: 'all 0.2s ease',
              minHeight: '36px'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--accent-color)';
              e.target.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border-color)';
              e.target.style.boxShadow = 'none';
            }}
          />
          <button 
            onClick={loadNewVideo}
            disabled={!newVideoUrl.trim() || isLoading}
            className="touch-friendly"
            style={{ 
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: newVideoUrl.trim() && !isLoading ? 'pointer' : 'not-allowed',
              opacity: newVideoUrl.trim() && !isLoading ? 1 : 0.6,
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minHeight: '36px',
              touchAction: 'manipulation',
              background: newVideoUrl.trim() && !isLoading ? 'var(--info-color)' : 'var(--bg-tertiary)',
              color: newVideoUrl.trim() && !isLoading ? '#fff' : 'var(--text-primary)',
              border: '1px solid var(--border-color)'
            }}
            title={isYouTubeUrl(newVideoUrl) ? 'Load YouTube video' : 'Load video from URL'}
          >
            <span style={{ fontSize: '14px' }}>🔗</span>
            {isLoading ? (
              <>⏳</>
            ) : isYouTubeUrl(newVideoUrl) ? (
              <>📺</>
            ) : (
              <>Load</>
            )}
          </button>
        </div>
      </div>

      {/* YouTube URL Warning */}
      {isYouTubeUrl(newVideoUrl) && (
        <div style={{
          marginTop: '-10px',
          marginBottom: '15px',
          padding: '8px 12px',
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
          marginTop: '-10px',
          marginBottom: '15px',
          padding: '8px 12px',
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

      <div style={{ 
        background: 'var(--bg-secondary)', 
        padding: '20px', 
        borderRadius: '8px',
        marginBottom: '15px',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ marginBottom: '12px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            marginBottom: '6px'
          }}>
            <span style={{ fontSize: '16px' }}>🎬</span>
            <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
              Now Playing:
            </strong>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
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
            marginBottom: '16px', 
            padding: '14px', 
            background: 'linear-gradient(135deg, rgba(40, 167, 69, 0.1), rgba(32, 201, 151, 0.05))',
            borderRadius: '12px', 
            border: '1px solid #28a745',
            boxShadow: '0 2px 8px rgba(40, 167, 69, 0.15)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              width: '80px',
              height: '80px',
              background: 'radial-gradient(circle, rgba(40, 167, 69, 0.1) 0%, transparent 70%)',
              borderRadius: '50%'
            }}></div>
            <h4 style={{ 
              color: '#28a745', 
              marginBottom: '10px',
              fontSize: '15px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              position: 'relative',
              zIndex: 1
            }}>
              <span style={{ fontSize: '18px' }}>📁</span> Upload Video
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
            className="btn-success touch-friendly"
              style={{ 
                marginBottom: '10px',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: '600',
                width: '100%',
                position: 'relative',
                zIndex: 1,
                minHeight: '40px',
                touchAction: 'manipulation'
              }}
              disabled={isUploading || isLoading}
            >
              {isUploading ? '⏳ Uploading...' : '📁 Upload Video'}
          </button>
            
            {isUploading && (
              <div style={{ marginTop: '10px', position: 'relative', zIndex: 1 }}>
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
              fontSize: '12px', 
              color: 'var(--text-secondary)', 
              marginTop: '8px',
              padding: '8px',
              background: 'var(--bg-tertiary)',
              borderRadius: '6px',
              textAlign: 'center',
              position: 'relative',
              zIndex: 1
            }}>
              💡 Anyone can upload - everyone gets access automatically! (max 1GB)
              <br />
              <span style={{ fontSize: '11px', opacity: 0.8 }}>
                Supported: MP4 (best), WebM, OGG, MOV, AVI, MKV
              </span>
            </div>
            
            {hostVideo && (
              <div style={{ 
                marginTop: '10px', 
                padding: '10px', 
                background: 'linear-gradient(135deg, rgba(40, 167, 69, 0.15), rgba(32, 201, 151, 0.1))',
                borderRadius: '8px',
                border: '1px solid rgba(40, 167, 69, 0.3)',
                position: 'relative',
                zIndex: 1
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  marginBottom: '6px'
                }}>
                  <span style={{ fontSize: '16px' }}>✅</span>
                  <strong style={{ color: '#28a745', fontSize: '13px' }}>
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
                    className="btn-success touch-friendly"
                    style={{
                      padding: '10px 18px',
                      fontSize: '14px',
                      fontWeight: '600',
                      borderRadius: '8px',
                      minHeight: '44px',
                      touchAction: 'manipulation'
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
          <div style={{ 
            marginTop: '10px', 
            padding: '10px', 
            background: 'linear-gradient(135deg, #28a745, #20c997)', 
            borderRadius: '8px',
            fontSize: '13px',
            display: window.innerWidth <= 768 ? 'block' : 'none'
          }}>
            <strong>📱 Mobile Controls:</strong> Swipe left/right on the video to seek, swipe up/down to adjust volume!
          </div>
        </div>
      </div>
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;