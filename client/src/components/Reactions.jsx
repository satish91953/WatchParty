import React, { useState, useEffect } from 'react';

const REACTION_EMOJIS = [
  { emoji: '👍', label: 'Like' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Laugh' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '🎉', label: 'Party' }
];

function Reactions({ socket, roomId }) {
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [showReactionBar, setShowReactionBar] = useState(false);
  const [recentReactions, setRecentReactions] = useState([]);

  const sendReaction = (emoji) => {
    if (!socket || !roomId) return;
    
    socket.emit('send_reaction', { roomId, emoji });
    
    // Add to recent reactions for quick access
    setRecentReactions(prev => {
      const filtered = prev.filter(r => r !== emoji);
      return [emoji, ...filtered].slice(0, 3);
    });
  };

  useEffect(() => {
    if (!socket) return;

    socket.on('reaction_received', (data) => {
      const id = Date.now() + Math.random();
      const reaction = {
        id,
        emoji: data.emoji,
        username: data.username,
        position: Math.random() * 70 + 15, // Random position between 15% and 85%
        delay: Math.random() * 500 // Random delay up to 500ms
      };
      
      setFloatingReactions(prev => [...prev, reaction]);
      
      // Remove reaction after animation
      setTimeout(() => {
        setFloatingReactions(prev => prev.filter(r => r.id !== id));
      }, 3500);
    });

    return () => {
      socket.off('reaction_received');
    };
  }, [socket]);

  // Auto-hide reaction bar after 5 seconds of inactivity
  useEffect(() => {
    if (showReactionBar) {
      const timer = setTimeout(() => {
        setShowReactionBar(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showReactionBar]);

  return (
    <>
      {/* Reaction trigger button */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 1001
      }}>
        <button
          onClick={() => setShowReactionBar(!showReactionBar)}
          style={{
            background: showReactionBar ? '#dc3545' : '#007bff',
            border: 'none',
            borderRadius: '50%',
            width: '60px',
            height: '60px',
            fontSize: '24px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'all 0.3s ease',
            transform: showReactionBar ? 'rotate(45deg)' : 'rotate(0deg)'
          }}
          title={showReactionBar ? 'Close reactions' : 'Send reaction'}
        >
          {showReactionBar ? '✕' : '😊'}
        </button>
      </div>

      {/* Reaction bar */}
      {showReactionBar && (
        <div style={{
          position: 'fixed',
          bottom: '90px',
          right: '20px',
          background: 'rgba(0,0,0,0.9)',
          padding: '15px',
          borderRadius: '15px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 1000,
          backdropFilter: 'blur(10px)',
          border: '1px solid #333',
          animation: 'slideUp 0.3s ease-out'
        }}>
          <div style={{ 
            color: 'white', 
            fontSize: '12px', 
            textAlign: 'center',
            marginBottom: '5px',
            fontWeight: '500'
          }}>
            Send Reaction
          </div>
          
          {/* Recent reactions */}
          {recentReactions.length > 0 && (
            <div style={{
              display: 'flex',
              gap: '8px',
              paddingBottom: '8px',
              borderBottom: '1px solid #444',
              marginBottom: '5px'
            }}>
              <span style={{ fontSize: '10px', color: '#ccc', alignSelf: 'center' }}>Recent:</span>
              {recentReactions.map((emoji, index) => (
                <button
                  key={index}
                  onClick={() => sendReaction(emoji)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid #555',
                    borderRadius: '8px',
                    fontSize: '20px',
                    width: '35px',
                    height: '35px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'scale(1.2)';
                    e.target.style.background = 'rgba(255,255,255,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'scale(1)';
                    e.target.style.background = 'rgba(255,255,255,0.1)';
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          
          {/* All reactions */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px'
          }}>
            {REACTION_EMOJIS.map(({ emoji, label }) => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid #555',
                  borderRadius: '10px',
                  fontSize: '24px',
                  width: '45px',
                  height: '45px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title={label}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.3)';
                  e.target.style.background = 'rgba(255,255,255,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                  e.target.style.background = 'rgba(255,255,255,0.1)';
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Floating reactions */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '100vh',
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 999
      }}>
        {floatingReactions.map(reaction => (
          <div
            key={reaction.id}
            className="floating-reaction"
            style={{
              position: 'absolute',
              bottom: '100px',
              left: `${reaction.position}%`,
              animation: `float-up 3s ease-out ${reaction.delay}ms forwards`,
              fontSize: '48px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.5))'
            }}
          >
            <span>{reaction.emoji}</span>
            <span style={{
              fontSize: '11px',
              background: 'rgba(0,0,0,0.8)',
              color: 'white',
              padding: '3px 8px',
              borderRadius: '12px',
              marginTop: '8px',
              whiteSpace: 'nowrap',
              fontWeight: '500',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              {reaction.username}
            </span>
          </div>
        ))}
      </div>
      
      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        @keyframes float-up {
          0% {
            transform: translateY(0) scale(0.5);
            opacity: 0;
          }
          10% {
            transform: translateY(-30px) scale(1);
            opacity: 1;
          }
          90% {
            transform: translateY(-450px) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-550px) scale(0.3);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}

export default Reactions;
