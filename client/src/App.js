import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [stats, setStats] = useState({ totalConversations: 0, todayConversations: 0, totalMessages: 0 });

  useEffect(() => {
    fetchStats();
    fetchConversations();
    const interval = setInterval(() => {
      fetchConversations();
      fetchStats();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchConversations() {
    try {
      const { data } = await axios.get('/api/conversations');
      setConversations(data);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    }
  }

  async function fetchStats() {
    try {
      const { data } = await axios.get('/api/stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }

  async function openConversation(id) {
    try {
      const { data } = await axios.get(`/api/conversations/${id}`);
      setSelectedConversation(data);
    } catch (err) {
      console.error('Failed to fetch conversation:', err);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Nivi WhatsApp Integration</h1>
        <div className="stats">
          <div className="stat-card">
            <span className="stat-number">{stats.totalConversations}</span>
            <span className="stat-label">שיחות</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.todayConversations}</span>
            <span className="stat-label">היום</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.totalMessages}</span>
            <span className="stat-label">הודעות</span>
          </div>
        </div>
      </header>

      <div className="content">
        <div className="conversation-list">
          <h2>שיחות</h2>
          {conversations.length === 0 && <p className="empty">אין שיחות עדיין</p>}
          {conversations.map(c => (
            <div
              key={c._id}
              className={`conversation-item ${selectedConversation?._id === c._id ? 'active' : ''}`}
              onClick={() => openConversation(c._id)}
            >
              <div className="conv-phone">{c.phoneNumber}</div>
              <div className="conv-preview">{c.lastMessage}</div>
              <div className="conv-meta">
                <span>{c.messageCount} הודעות</span>
                <span>{new Date(c.lastActivity).toLocaleString('he-IL')}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="message-view">
          {selectedConversation ? (
            <>
              <h2>שיחה עם {selectedConversation.phoneNumber}</h2>
              <div className="messages">
                {selectedConversation.messages.map((msg, i) => (
                  <div key={i} className={`message ${msg.direction}`}>
                    <div className="message-bubble">
                      <p>{msg.body}</p>
                      <span className="message-time">
                        {new Date(msg.timestamp).toLocaleTimeString('he-IL')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="no-selection">בחר שיחה מהרשימה</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
