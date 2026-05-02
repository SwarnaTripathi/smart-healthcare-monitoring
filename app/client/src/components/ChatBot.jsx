import { useState, useRef, useEffect } from 'react';
import api from '../utils/api';
import { FiMessageCircle, FiX, FiSend, FiCpu } from 'react-icons/fi';

function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { from: 'bot', text: "Hi! 👋 I'm **HealthGuard AI**, your healthcare assistant.\n\nAsk me about your vitals, health tips, first aid, or anything health-related!", type: 'info', time: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || typing) return;

    const userMsg = { from: 'user', text: input.trim(), time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    try {
      const { data } = await api.post('/chatbot', { message: userMsg.text });
      setTimeout(() => {
        setMessages(prev => [...prev, { from: 'bot', text: data.reply, type: data.type, time: new Date() }]);
        setTyping(false);
      }, 500 + Math.random() * 700);
    } catch (e) {
      setMessages(prev => [...prev, { from: 'bot', text: "Sorry, I couldn't process that. Please try again.", type: 'error', time: new Date() }]);
      setTyping(false);
    }
  };

  const quickActions = [
    { label: '📊 My Vitals', msg: 'Show my vitals' },
    { label: '💡 Health Tips', msg: 'Health tips' },
    { label: '🆘 Emergency', msg: 'Emergency help' },
    { label: '🩺 Normal HR?', msg: 'Normal heart rate' },
  ];

  // Simple markdown-like rendering
  const renderText = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  };

  const typeColor = { emergency: '#ef4444', warning: '#fbbf24', tip: '#06d6a0', info: '#4cc9f0', error: '#ef4444' };

  return (
    <>
      {/* Floating Button */}
      <button className={`chatbot-fab ${open ? 'open' : ''}`} onClick={() => setOpen(!open)} title="HealthGuard AI Assistant">
        {open ? <FiX /> : <FiMessageCircle />}
        {!open && <span className="fab-pulse"></span>}
      </button>

      {/* Chat Window */}
      {open && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <div className="chatbot-avatar"><FiCpu /></div>
              <div>
                <div className="chatbot-title">HealthGuard AI</div>
                <div className="chatbot-status">
                  <span className="status-dot"></span> Online
                </div>
              </div>
            </div>
            <button className="chatbot-close" onClick={() => setOpen(false)}><FiX /></button>
          </div>

          <div className="chatbot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-msg ${msg.from}`}>
                {msg.from === 'bot' && (
                  <div className="msg-avatar"><FiCpu /></div>
                )}
                <div className="msg-bubble" style={msg.type ? { borderLeft: `3px solid ${typeColor[msg.type] || '#4cc9f0'}` } : {}}>
                  <div dangerouslySetInnerHTML={{ __html: renderText(msg.text) }} />
                  <div className="msg-time">{new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            ))}

            {typing && (
              <div className="chat-msg bot">
                <div className="msg-avatar"><FiCpu /></div>
                <div className="msg-bubble typing-bubble">
                  <div className="typing-dots">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick Actions */}
          {messages.length <= 2 && (
            <div className="chatbot-quick">
              {quickActions.map((qa, i) => (
                <button key={i} onClick={() => { setInput(qa.msg); setTimeout(() => document.querySelector('.chatbot-send')?.click(), 50); }}>
                  {qa.label}
                </button>
              ))}
            </div>
          )}

          <form className="chatbot-input" onSubmit={sendMessage}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask me anything about health..."
              disabled={typing}
            />
            <button type="submit" className="chatbot-send" disabled={!input.trim() || typing}>
              <FiSend />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export default ChatBot;
