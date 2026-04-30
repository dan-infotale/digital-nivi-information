import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TenantLayout } from '../../components/Layout';
import Icon from '../../components/Icons';
import api from '../../api';

function getInitials(phone) {
  return phone ? phone.slice(-2) : '??';
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function groupByDay(messages) {
  const groups = [];
  let currentDay = null;
  for (const msg of messages) {
    const day = formatDate(msg.timestamp);
    if (day !== currentDay) {
      groups.push({ type: 'divider', label: day });
      currentDay = day;
    }
    groups.push({ type: 'msg', msg });
  }
  return groups;
}

export default function Conversations() {
  const [conversations, setConversations] = useState([]);
  const [connectors, setConnectors] = useState([]);
  const [filterConnector, setFilterConnector] = useState('');
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState({ totalConversations: 0, todayConversations: 0, totalMessages: 0 });
  const messagesEndRef = useRef(null);

  const load = useCallback(async () => {
    const params = filterConnector ? `?connectorId=${filterConnector}` : '';
    const [c, s, conn] = await Promise.all([
      api.get(`/conversations${params}`),
      api.get('/conversations/stats'),
      api.get('/connectors'),
    ]);
    setConversations(c.data);
    setStats(s.data);
    setConnectors(conn.data);
  }, [filterConnector]);

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selected]);

  async function openConversation(id) {
    const { data } = await api.get(`/conversations/${id}`);
    setSelected(data);
  }

  async function deleteConversation(id) {
    if (!window.confirm('Delete this conversation?')) return;
    await api.delete(`/conversations/${id}`);
    if (selected?._id === id) setSelected(null);
    load();
  }

  return (
    <TenantLayout title="Conversations">
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-number">{stats.totalConversations}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{stats.todayConversations}</span>
          <span className="stat-label">Today</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{stats.totalMessages}</span>
          <span className="stat-label">Messages</span>
        </div>
      </div>

      <div className="inbox">
        <div className="conv-list">
          <div className="conv-list-header">
            <h3>All Conversations</h3>
            <select
              value={filterConnector}
              onChange={e => setFilterConnector(e.target.value)}
              className="filter-select"
            >
              <option value="">All connectors</option>
              {connectors.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="conv-list-items">
            {conversations.length === 0 && <div className="empty">No conversations yet</div>}
            {conversations.map(c => (
              <div
                key={c._id}
                className={`conv-row ${selected?._id === c._id ? 'active' : ''}`}
                onClick={() => openConversation(c._id)}
              >
                <div className="conv-avatar">{getInitials(c.phoneNumber)}</div>
                <div className="conv-row-info">
                  <div className="conv-phone">{c.phoneNumber}</div>
                  {c.connector?.name && <div className="conv-connector-tag">{c.connector.name}</div>}
                  <div className="conv-preview">{c.lastMessage}</div>
                  <div className="conv-meta-row">
                    <span>{c.messageCount} msg</span>
                    <span>{new Date(c.lastActivity).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="thread-view">
          {selected ? (
            <>
              <div className="thread-header">
                <div>
                  <div className="thread-phone">{selected.phoneNumber}</div>
                  {selected.connectorId?.name && (
                    <div className="thread-connector">{selected.connectorId.name}</div>
                  )}
                </div>
                <button className="btn-danger" onClick={() => deleteConversation(selected._id)}>
                  <Icon name="trash" size={13} style={{ marginRight: 4 }} />
                  Delete
                </button>
              </div>
              <div className="thread-messages">
                {groupByDay(selected.messages).map((item, i) =>
                  item.type === 'divider' ? (
                    <div key={i} className="day-divider">{item.label}</div>
                  ) : (
                    <div key={i} className={`msg ${item.msg.direction === 'incoming' ? 'in' : 'out'}`}>
                      <div className="msg-bubble">
                        <div className="msg-text">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {item.msg.body}
                          </ReactMarkdown>
                        </div>
                        <span className="msg-time">{formatTime(item.msg.timestamp)}</span>
                      </div>
                    </div>
                  )
                )}
                <div ref={messagesEndRef} />
              </div>
            </>
          ) : (
            <div className="no-selection">
              <Icon name="chat" size={32} style={{ color: 'var(--fg-4)' }} />
              <span>Select a conversation to view messages</span>
            </div>
          )}
        </div>
      </div>
    </TenantLayout>
  );
}
