import React, { useState, useEffect, useCallback } from 'react';

// Notification types
const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error'
};

// Notification context for global access
const NotificationContext = React.createContext();

// Notification Provider Component
export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [settings, setSettings] = useState(() => {
    // Load settings from localStorage
    const saved = localStorage.getItem('watchParty_notificationSettings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing notification settings:', e);
      }
    }
    // Default settings
    return {
      userJoined: true,
      userLeft: true,
      videoUploaded: true,
      videoChanged: true,
      chatMessage: false, // Don't notify for every chat message
      voiceChat: true,
      duration: 4000, // 4 seconds
      position: 'top-right',
      sound: false
    };
  });

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('watchParty_notificationSettings', JSON.stringify(settings));
  }, [settings]);

  // Remove notification
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Show notification function
  const showNotification = useCallback((notification) => {
    const {
      type = NOTIFICATION_TYPES.INFO,
      title,
      message,
      duration = settings.duration,
      sound = settings.sound,
      icon,
      action
    } = notification;

    // Check if this notification type is enabled
    const notificationKey = notification.key;
    if (notificationKey && !settings[notificationKey]) {
      return; // Don't show if disabled
    }

    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      type,
      title,
      message,
      icon,
      action,
      duration,
      timestamp: Date.now()
    };

    setNotifications(prev => [...prev, newNotification]);

    // Play sound if enabled
    if (sound) {
      // Create a subtle notification sound
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    }

    // Auto-remove notification after duration
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }

    return id;
  }, [settings, removeNotification]);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Update settings
  const updateSettings = useCallback((newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const value = {
    notifications,
    showNotification,
    removeNotification,
    clearAll,
    settings,
    updateSettings,
    NOTIFICATION_TYPES
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
}

// Hook to use notifications
export function useNotifications() {
  const context = React.useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

// Notification Container Component
function NotificationContainer() {
  const { notifications, removeNotification, settings } = useNotifications();
  const position = settings.position || 'top-right';

  const getPositionStyles = () => {
    const baseStyles = {
      position: 'fixed',
      zIndex: 10000,
      pointerEvents: 'none',
      maxWidth: '400px',
      width: 'calc(100% - 32px)'
    };

    switch (position) {
      case 'top-left':
        return { ...baseStyles, top: '20px', left: '20px' };
      case 'top-center':
        return { ...baseStyles, top: '20px', left: '50%', transform: 'translateX(-50%)' };
      case 'top-right':
        return { ...baseStyles, top: '20px', right: '20px' };
      case 'bottom-left':
        return { ...baseStyles, bottom: '20px', left: '20px' };
      case 'bottom-center':
        return { ...baseStyles, bottom: '20px', left: '50%', transform: 'translateX(-50%)' };
      case 'bottom-right':
        return { ...baseStyles, bottom: '20px', right: '20px' };
      default:
        return { ...baseStyles, top: '20px', right: '20px' };
    }
  };

  return (
    <div style={getPositionStyles()}>
      {notifications.map(notification => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}

// Individual Notification Toast Component
function NotificationToast({ notification, onClose }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 300); // Animation duration
  };

  const getTypeStyles = () => {
    switch (notification.type) {
      case NOTIFICATION_TYPES.SUCCESS:
        return {
          background: 'linear-gradient(135deg, #28a745, #20c997)',
          borderColor: '#28a745',
          icon: '✅'
        };
      case NOTIFICATION_TYPES.ERROR:
        return {
          background: 'linear-gradient(135deg, #dc3545, #c82333)',
          borderColor: '#dc3545',
          icon: '❌'
        };
      case NOTIFICATION_TYPES.WARNING:
        return {
          background: 'linear-gradient(135deg, #ffc107, #ff9800)',
          borderColor: '#ffc107',
          icon: '⚠️'
        };
      case NOTIFICATION_TYPES.INFO:
      default:
        return {
          background: 'linear-gradient(135deg, #17a2b8, #138496)',
          borderColor: '#17a2b8',
          icon: 'ℹ️'
        };
    }
  };

  const typeStyles = getTypeStyles();
  const icon = notification.icon || typeStyles.icon;

  return (
    <div
      style={{
        background: typeStyles.background,
        color: 'white',
        padding: '16px 20px',
        borderRadius: '12px',
        marginBottom: '12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
        border: `2px solid ${typeStyles.borderColor}`,
        pointerEvents: 'auto',
        cursor: 'pointer',
        transform: isExiting ? 'translateX(100%)' : 'translateX(0)',
        opacity: isExiting ? 0 : 1,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        animation: 'slideInRight 0.3s ease-out',
        backdropFilter: 'blur(10px)',
        position: 'relative',
        overflow: 'hidden'
      }}
      onClick={handleClose}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateX(-4px) scale(1.02)';
      }}
      onMouseLeave={(e) => {
        if (!isExiting) {
          e.currentTarget.style.transform = 'translateX(0) scale(1)';
        }
      }}
    >
      {/* Decorative gradient overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: 'rgba(255, 255, 255, 0.3)',
        boxShadow: '0 0 10px rgba(255, 255, 255, 0.2)'
      }}></div>

      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        <div style={{
          fontSize: '24px',
          lineHeight: 1,
          flexShrink: 0
        }}>
          {icon}
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          {notification.title && (
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              marginBottom: '4px',
              lineHeight: 1.3
            }}>
              {notification.title}
            </div>
          )}
          {notification.message && (
            <div style={{
              fontSize: '14px',
              opacity: 0.95,
              lineHeight: 1.4,
              wordWrap: 'break-word'
            }}>
              {notification.message}
            </div>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            lineHeight: 1,
            flexShrink: 0,
            transition: 'all 0.2s ease',
            padding: 0
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.3)';
            e.target.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.2)';
            e.target.style.transform = 'scale(1)';
          }}
        >
          ×
        </button>
      </div>

      {/* Progress bar for auto-dismiss */}
      {notification.duration > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '0 0 12px 12px',
          overflow: 'hidden'
        }}>
          <div
            style={{
              height: '100%',
              background: 'rgba(255, 255, 255, 0.5)',
              width: '100%',
              animation: `shrink ${notification.duration}ms linear forwards`
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}

// Notification Settings Button Component
export function NotificationSettingsButton() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="touch-friendly"
        style={{
          width: '100%',
          padding: '12px',
          fontSize: '14px',
          fontWeight: '600',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.2s ease',
          minHeight: '44px'
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
        🔔 Notification Settings
      </button>

      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="component-card"
            style={{
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: '20px',
                fontWeight: '700',
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                color: 'var(--text-primary)'
              }}>
                🔔 Notification Settings
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'var(--bg-tertiary)';
                  e.target.style.borderColor = 'var(--accent-color)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                  e.target.style.borderColor = 'var(--border-color)';
                }}
              >
                ✕ Close
              </button>
            </div>
            <NotificationSettingsContent />
          </div>
        </div>
      )}
    </>
  );
}

// Notification Settings Content (used in both panel and modal)
function NotificationSettingsContent() {
  const { settings, updateSettings } = useNotifications();

  const toggleSetting = (key) => {
    updateSettings({ [key]: !settings[key] });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Notification Toggles */}
      <div>
        <strong style={{ color: 'var(--text-primary)', marginBottom: '10px', display: 'block', fontSize: '14px' }}>
          Events:
        </strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            { key: 'userJoined', label: 'User Joined', icon: '👋' },
            { key: 'userLeft', label: 'User Left', icon: '👋' },
            { key: 'videoUploaded', label: 'Video Uploaded', icon: '📁' },
            { key: 'videoChanged', label: 'Video Changed', icon: '🎬' },
            { key: 'voiceChat', label: 'Voice Chat Events', icon: '🎤' }
          ].map(({ key, label, icon }) => (
            <label
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: 'var(--bg-tertiary)',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: '1px solid var(--border-color)',
                fontSize: '13px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-secondary)';
                e.currentTarget.style.borderColor = 'var(--accent-color)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={() => toggleSetting(key)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                  accentColor: 'var(--accent-color)',
                  flexShrink: 0
                }}
              />
              <span style={{ fontSize: '16px', flexShrink: 0 }}>{icon}</span>
              <span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px' }}>
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Duration Setting */}
      <div>
        <strong style={{ color: 'var(--text-primary)', marginBottom: '8px', display: 'block', fontSize: '14px' }}>
          Auto-dismiss:
        </strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="range"
            min="2000"
            max="10000"
            step="1000"
            value={settings.duration}
            onChange={(e) => updateSettings({ duration: parseInt(e.target.value) })}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              accentColor: 'var(--accent-color)',
              cursor: 'pointer'
            }}
          />
          <span style={{
            minWidth: '50px',
            textAlign: 'right',
            color: 'var(--text-primary)',
            fontWeight: '600',
            fontSize: '12px'
          }}>
            {settings.duration / 1000}s
          </span>
        </div>
      </div>

      {/* Position Setting */}
      <div>
        <strong style={{ color: 'var(--text-primary)', marginBottom: '8px', display: 'block', fontSize: '14px' }}>
          Position:
        </strong>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '6px'
        }}>
          {['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].map((pos) => (
            <button
              key={pos}
              onClick={(e) => {
                e.stopPropagation();
                updateSettings({ position: pos });
              }}
              style={{
                padding: '8px 6px',
                borderRadius: '6px',
                border: settings.position === pos ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                background: settings.position === pos ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                color: settings.position === pos ? 'white' : 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: settings.position === pos ? '700' : '500',
                transition: 'all 0.2s ease',
                textTransform: 'capitalize'
              }}
              onMouseEnter={(e) => {
                if (settings.position !== pos) {
                  e.target.style.background = 'var(--bg-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                if (settings.position !== pos) {
                  e.target.style.background = 'var(--bg-tertiary)';
                }
              }}
            >
              {pos.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Sound Toggle */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 12px',
          background: 'var(--bg-tertiary)',
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          border: '1px solid var(--border-color)',
          fontSize: '13px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-secondary)';
          e.currentTarget.style.borderColor = 'var(--accent-color)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-tertiary)';
          e.currentTarget.style.borderColor = 'var(--border-color)';
        }}
      >
        <input
          type="checkbox"
          checked={settings.sound}
          onChange={() => toggleSetting('sound')}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '18px',
            height: '18px',
            cursor: 'pointer',
            accentColor: 'var(--accent-color)',
            flexShrink: 0
          }}
        />
        <span style={{ fontSize: '16px', flexShrink: 0 }}>🔊</span>
        <span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px' }}>
          Play Sound
        </span>
      </label>
    </div>
  );
}

// Notification Settings Component (kept for backward compatibility, but can be removed)
export function NotificationSettings() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="component-card" style={{ marginBottom: 0 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: isExpanded ? '16px' : '0',
        cursor: 'pointer'
      }}
      onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 style={{ 
          margin: 0, 
          fontSize: '18px',
          fontWeight: '700',
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          color: 'var(--text-primary)'
        }}>
          🔔 Notifications
        </h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '6px 12px',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            fontSize: '12px',
            fontWeight: '600',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'var(--bg-tertiary)';
            e.target.style.borderColor = 'var(--accent-color)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'transparent';
            e.target.style.borderColor = 'var(--border-color)';
          }}
        >
          {isExpanded ? '▲ Hide' : '▼ Show'}
        </button>
      </div>
      
      {isExpanded && <NotificationSettingsContent />}
    </div>
  );
}

