import React, { useState, useEffect, useRef } from 'react';

function TextChat({ socket, roomId, currentUser, messages: initialMessages = [] }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(initialMessages);
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

    socket.on('chat_message', (data) => {
      setMessages(prev => [...prev, {
        id: Date.now() + Math.random(),
        sender: data.sender,
        message: data.message,
        timestamp: new Date(data.timestamp).toLocaleTimeString(),
        isOwn: false
      }]);
    });

    return () => {
      socket.off('chat_message');
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
      timestamp: new Date().toLocaleTimeString(),
      isOwn: true
    }]);

    setMessage('');
    chatInputRef.current?.focus();
  };

  const formatTime = (timestamp) => {
    if (typeof timestamp === 'string') return timestamp;
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="component-card" style={{ height: '500px', display: 'flex', flexDirection: 'column' }}>
      <h3>💬 Chat</h3>
      
      <div style={{
        flex: 1,
        overflowY: 'auto',
        background: 'var(--bg-tertiary)',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '20px',
        border: '1px solid var(--border-color)',
        boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)'
      }}>
        {messages.length === 0 ? (
          <div style={{ 
            color: 'var(--text-muted)', 
            textAlign: 'center', 
            padding: '60px 20px',
            fontStyle: 'italic'
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
              No messages yet. Start the conversation!
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div 
              key={msg.id} 
              style={{ 
                marginBottom: '16px',
                padding: '14px 16px',
                background: msg.isOwn 
                  ? 'linear-gradient(135deg, rgba(0, 123, 255, 0.15), rgba(0, 86, 179, 0.1))' 
                  : 'var(--bg-secondary)',
                borderRadius: '12px',
                borderLeft: `4px solid ${msg.isOwn ? '#007bff' : '#28a745'}`,
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateX(4px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateX(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <strong style={{ 
                  color: msg.isOwn ? '#007bff' : '#28a745',
                  fontSize: '14px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  {msg.isOwn && <span>👤</span>}
                  {msg.sender}
                </strong>
                <span style={{ 
                  fontSize: '11px', 
                  color: 'var(--text-muted)',
                  fontFamily: 'monospace',
                  background: 'var(--bg-tertiary)',
                  padding: '3px 8px',
                  borderRadius: '6px'
                }}>
                  {formatTime(msg.timestamp)}
                </span>
              </div>
              <div style={{ 
                color: 'var(--text-primary)',
                lineHeight: '1.6',
                wordWrap: 'break-word',
                fontSize: '14px'
              }}>
                {msg.message}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            ref={chatInputRef}
            type="text"
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ 
              width: '100%',
              padding: '14px 16px',
              fontSize: '15px',
              borderRadius: '12px'
            }}
            maxLength={500}
            autoComplete="off"
          />
          <div style={{
            position: 'absolute',
            bottom: '-20px',
            right: '8px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            background: 'var(--bg-secondary)',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            {message.length}/500
          </div>
        </div>
        <button 
          type="submit"
          disabled={!message.trim()}
          className={message.trim() ? 'btn-success' : ''}
          style={{
            background: message.trim() 
              ? 'linear-gradient(135deg, #28a745, #20c997)' 
              : 'var(--bg-tertiary)',
            color: message.trim() ? 'white' : 'var(--text-muted)',
            minWidth: '100px',
            padding: '14px 20px',
            fontSize: '15px',
            fontWeight: '600',
            borderRadius: '12px',
            cursor: message.trim() ? 'pointer' : 'not-allowed',
            opacity: message.trim() ? 1 : 0.6,
            boxShadow: message.trim() ? '0 4px 12px rgba(40, 167, 69, 0.3)' : 'none',
            transition: 'all 0.3s ease'
          }}
        >
          📤 Send
        </button>
      </form>
      
      <div style={{
        fontSize: '12px',
        color: 'var(--text-muted)',
        marginTop: '24px',
        textAlign: 'center',
        padding: '8px',
        background: 'var(--bg-tertiary)',
        borderRadius: '8px'
      }}>
        💡 Press <kbd style={{
          background: 'var(--bg-secondary)',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: '600'
        }}>Enter</kbd> to send
      </div>
    </div>
  );
}

export default TextChat;
