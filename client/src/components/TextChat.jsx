import React, { useState, useEffect, useRef } from 'react';

function TextChat({ socket, roomId, currentUser, messages: initialMessages = [], noCard = false }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(initialMessages);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    const currentUsername = localStorage.getItem('watchParty_username') || '';

    const handleChatMessage = (data) => {
      // Check if this message is from the current user
      const isOwnMessage = data.sender === currentUsername;
      
      // If it's our own message, we've already added it locally, so skip
      if (isOwnMessage) {
        return;
      }

      // Add message from other users
      setMessages(prev => {
        // Check for duplicates (same sender and message)
        const isDuplicate = prev.some(msg => 
          msg.sender === data.sender && 
          msg.message === data.message
        );
        
        if (isDuplicate) {
          return prev;
        }

        return [...prev, {
          id: Date.now() + Math.random(),
          sender: data.sender,
          message: data.message,
          timestamp: data.timestamp || new Date().toISOString(),
          isOwn: false
        }];
      });
    };

    socket.on('chat_message', handleChatMessage);

    return () => {
      socket.off('chat_message', handleChatMessage);
    };
  }, [socket]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !socket) return;

    const messageData = {
      roomId,
      message: message.trim()
    };

    // Send to server
    socket.emit('chat_message', messageData);

    // Add to local messages
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      sender: 'You',
      message: message.trim(),
      timestamp: new Date().toISOString(),
      isOwn: true
    }]);

    setMessage('');
    chatInputRef.current?.focus();
  };

  const formatTime = (timestamp) => {
    if (typeof timestamp === 'string') {
      // If it's already an ISO string, return it
      if (timestamp.includes('T')) return timestamp;
      // Otherwise try to parse it
      try {
        return new Date(timestamp).toISOString();
      } catch {
        return timestamp;
      }
    }
    return new Date(timestamp).toISOString();
  };

  const cardStyle = noCard ? {} : { className: 'component-card' };
  
  return (
    <div {...cardStyle} style={{ 
      height: isMinimized ? 'auto' : '100%', 
      maxHeight: isMinimized ? 'auto' : '600px',
      display: 'flex', 
      flexDirection: 'column',
      padding: isMinimized ? '20px' : (noCard ? '20px 20px 0 20px' : '20px 20px 0 20px'),
      ...(noCard ? {
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        marginBottom: 0
      } : {})
    }}>
      {!noCard && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: isMinimized ? '0' : '24px',
          paddingBottom: isMinimized ? '0' : '16px',
          borderBottom: isMinimized ? 'none' : '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>💬 Chat</h3>
            {!isMinimized && messages.length > 0 && (
              <span style={{
                padding: '4px 10px',
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: 'white',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: '700',
                boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)'
              }}>
                {messages.length}
              </span>
            )}
          </div>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '8px 14px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.borderColor = 'var(--accent-color)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {isMinimized ? '▼ Expand' : '▲ Minimize'}
          </button>
        </div>
      )}
      
      {isMinimized ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px',
          background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <span style={{
            padding: '8px 16px',
            background: messages.length > 0 
              ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
              : 'var(--bg-tertiary)',
            color: messages.length > 0 ? 'white' : 'var(--text-secondary)',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: '700',
            boxShadow: messages.length > 0 ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none',
            letterSpacing: '0.3px'
          }}>
            💬 {messages.length} message{messages.length !== 1 ? 's' : ''}
          </span>
          {messages.length > 0 && (
            <span style={{ 
              color: 'var(--text-primary)', 
              fontSize: '14px',
              fontWeight: '600',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              padding: '6px 12px',
              background: 'var(--bg-tertiary)',
              borderRadius: '8px'
            }}>
              Last: <strong style={{ color: 'var(--accent-color)' }}>{messages[messages.length - 1].sender}</strong>: {messages[messages.length - 1].message.substring(0, 35)}{messages[messages.length - 1].message.length > 35 ? '...' : ''}
            </span>
          )}
        </div>
      ) : (
        <>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        background: 'var(--bg-tertiary)',
        padding: '16px',
        borderRadius: '8px',
        marginBottom: '12px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }}>
        {messages.length === 0 ? (
          <div style={{ 
            color: 'var(--text-muted)', 
            textAlign: 'center', 
            padding: '40px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1
          }}>
            <div style={{ 
              fontSize: '48px', 
              marginBottom: '16px',
              opacity: 0.5
            }}>💭</div>
            <div style={{ 
              fontSize: '16px',
              fontWeight: '500',
              color: 'var(--text-secondary)'
            }}>
              No messages yet
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={msg.id} 
              style={{ 
                marginBottom: '16px',
                padding: '12px 16px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                borderLeft: '3px solid #10b981',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <strong style={{ 
                  color: '#10b981',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  {msg.sender}
                </strong>
                <span style={{ 
                  fontSize: '11px', 
                  color: 'var(--text-muted)',
                  fontFamily: 'monospace',
                  fontWeight: '400'
                }}>
                  {formatTime(msg.timestamp)}
                </span>
              </div>
              <div style={{ 
                color: 'var(--text-primary)',
                lineHeight: '1.5',
                wordWrap: 'break-word',
                fontSize: '14px',
                fontWeight: '400'
              }}>
                {msg.message}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '8px',
        padding: '12px 0 20px 0',
        flexShrink: 0,
        marginTop: 'auto'
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              ref={chatInputRef}
              type="text"
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && message.trim()) {
                  e.preventDefault();
                  sendMessage(e);
                }
              }}
              style={{ 
                width: '100%',
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '400',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#10b981';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border-color)';
              }}
              maxLength={500}
              autoComplete="off"
            />
          </div>
          <button 
            type="submit"
            disabled={!message.trim()}
            style={{
              background: message.trim() ? '#10b981' : 'var(--bg-tertiary)',
              color: message.trim() ? 'white' : 'var(--text-muted)',
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              cursor: message.trim() ? 'pointer' : 'not-allowed',
              opacity: message.trim() ? 1 : 0.5,
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              if (message.trim()) {
                e.currentTarget.style.background = '#059669';
              }
            }}
            onMouseLeave={(e) => {
              if (message.trim()) {
                e.currentTarget.style.background = '#10b981';
              }
            }}
          >
            <span>📤</span>
            <span>Send</span>
          </button>
        </div>
        <div style={{
          textAlign: 'right',
          fontSize: '11px',
          color: 'var(--text-muted)',
          fontFamily: 'monospace',
          paddingRight: '4px'
        }}>
          {message.length}/500
        </div>
      </form>
        </>
      )}
    </div>
  );
}

export default TextChat;
