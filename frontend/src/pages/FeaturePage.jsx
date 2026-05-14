import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import api from '../api';

function AIResponseDisplay({ data, loading }) {
  if (loading) {
    return (
      <div className="ai-response">
        <div className="ai-loading">
          <div className="spinner"></div>
          <span>AI is analyzing... Please wait</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="ai-response">
      <div className="ai-response-header">
        <span className="ai-badge">AI Analysis</span>
        <span className="ai-model">{data.model || 'AI Model'}</span>
      </div>
      <div className="ai-response-content">
        <ReactMarkdown>{data.response || 'No analysis available'}</ReactMarkdown>
      </div>
      {data.usage && (
        <div className="ai-response-footer">
          <span>Tokens: {data.usage.total_tokens || 'N/A'}</span>
          <span>Prompt: {data.usage.prompt_tokens || 'N/A'}</span>
          <span>Response: {data.usage.completion_tokens || 'N/A'}</span>
          {data.id && <span>ID: {data.id}</span>}
        </div>
      )}
    </div>
  );
}

function DetailPanel({ item, config, onClose, onEdit, onDelete, onAIAnalyze }) {
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const handleAI = async () => {
    setAiLoading(true);
    try {
      const payload = {};
      (config.aiPromptFields || []).forEach(key => {
        payload[key] = item[key] || '';
      });
      const res = await api.post(`${config.apiPath}/ai-analyze`, payload);
      setAiResult(res.data);
    } catch (err) {
      toast.error('AI analysis failed');
    } finally {
      setAiLoading(false);
    }
  };

  if (!item) return null;

  return (
    <div className="detail-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="detail-panel">
        <div className="detail-header">
          <h2>{config.icon} {config.name} Details</h2>
          <button className="detail-close" onClick={onClose}>✕</button>
        </div>
        <div className="detail-body">
          {config.detailFields.map((field) => {
            const value = item[field.key];
            if (value === null || value === undefined || value === '') return null;

            if (field.isAI) {
              return (
                <div key={field.key} className="detail-field">
                  <div className="ai-response" style={{ marginTop: 0 }}>
                    <div className="ai-response-header">
                      <span className="ai-badge">Stored AI Analysis</span>
                      <span className="ai-model">{field.label}</span>
                    </div>
                    <div className="ai-response-content">
                      <ReactMarkdown>{String(value)}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              );
            }

            let displayValue = value;
            if (typeof value === 'boolean') displayValue = value ? 'Yes' : 'No';
            if (field.prefix) displayValue = `${field.prefix}${displayValue}`;
            if (field.suffix) displayValue = `${displayValue}${field.suffix}`;

            const isBadge = ['severity', 'status', 'risk_level', 'damage_level', 'priority', 'trend', 'difficulty_level', 'availability', 'water_stress'].includes(field.key);

            return (
              <div key={field.key} className="detail-field">
                <label>{field.label}</label>
                <div className="value">
                  {isBadge ? (
                    <span className={`badge badge-${String(value).toLowerCase().replace(/\s/g, '_')}`}>{String(value)}</span>
                  ) : (
                    String(displayValue)
                  )}
                </div>
              </div>
            );
          })}

          <AIResponseDisplay data={aiResult} loading={aiLoading} />
        </div>
        <div className="detail-actions">
          <button className="btn btn-ai" onClick={handleAI} disabled={aiLoading}>
            {aiLoading ? '⏳ Analyzing...' : '🤖 AI Analyze'}
          </button>
          <button className="btn btn-primary" onClick={() => onEdit(item)}>✏️ Edit</button>
          <button className="btn btn-danger" onClick={() => onDelete(item.id)}>🗑️ Delete</button>
        </div>
      </div>
    </div>
  );
}

function FormModal({ config, item, onClose, onSave }) {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (item) {
      setFormData({ ...item });
    } else {
      const initial = {};
      config.fields.forEach(f => { initial[f.key] = ''; });
      setFormData(initial);
    }
  }, [item, config]);

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleaned = { ...formData };
    delete cleaned.id;
    delete cleaned.created_at;
    delete cleaned.user_id;
    // Remove AI fields
    Object.keys(cleaned).forEach(key => {
      if (key.startsWith('ai_')) delete cleaned[key];
    });
    onSave(cleaned, item?.id);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{item ? 'Edit' : 'New'} {config.name}</h2>
          <button className="detail-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {config.fields.map((field) => (
              <div key={field.key} className="form-group">
                <label>{field.label} {field.required && '*'}</label>
                {field.type === 'textarea' ? (
                  <textarea
                    value={formData[field.key] || ''}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    required={field.required}
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={formData[field.key] || ''}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  >
                    <option value="">Select...</option>
                    {field.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    value={formData[field.key] || ''}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    required={field.required}
                    step={field.type === 'number' ? 'any' : undefined}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              {item ? '💾 Update' : '➕ Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FeaturePage({ config }) {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    try {
      const res = await api.get(config.apiPath);
      // Backend may return { data, total, page, limit } (paginated) or array
      const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setItems(list);
    } catch (err) {
      toast.error(`Failed to load ${config.name}`);
    } finally {
      setLoading(false);
    }
  }, [config.apiPath, config.name]);

  useEffect(() => {
    setLoading(true);
    setSelectedItem(null);
    setShowForm(false);
    setEditItem(null);
    loadItems();
  }, [loadItems]);

  const handleSave = async (data, id) => {
    try {
      if (id) {
        await api.put(`${config.apiPath}/${id}`, data);
        toast.success(`${config.name} updated!`);
      } else {
        await api.post(config.apiPath, data);
        toast.success(`${config.name} created!`);
      }
      setShowForm(false);
      setEditItem(null);
      loadItems();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(`Delete this ${config.name.toLowerCase()}?`)) return;
    try {
      await api.delete(`${config.apiPath}/${id}`);
      toast.success(`${config.name} deleted!`);
      setSelectedItem(null);
      loadItems();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const handleEdit = (item) => {
    setSelectedItem(null);
    setEditItem(item);
    setShowForm(true);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{config.icon} {config.name}</h1>
          <p className="subtitle">{config.description}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowForm(true); }}>
          ➕ New {config.name}
        </button>
      </div>

      <div className="data-table-container">
        <div className="table-header">
          <h2>{items.length} Records</h2>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            No records found. Click "New {config.name}" to add one.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                {config.columns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} onClick={() => setSelectedItem(item)}>
                  <td>{idx + 1}</td>
                  {config.columns.map((col) => {
                    let value = item[col.key];
                    if (value === null || value === undefined) value = '-';

                    if (col.boolean) {
                      return (
                        <td key={col.key}>
                          <span style={{ color: value ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                            {value ? '● Yes' : '○ No'}
                          </span>
                        </td>
                      );
                    }

                    if (col.badge) {
                      return (
                        <td key={col.key}>
                          <span className={`badge badge-${String(value).toLowerCase().replace(/\s/g, '_')}`}>
                            {String(value)}
                          </span>
                        </td>
                      );
                    }

                    let display = String(value);
                    if (col.prefix) display = `${col.prefix}${display}`;
                    if (col.suffix) display = `${display}${col.suffix}`;

                    return <td key={col.key}>{display}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedItem && (
        <DetailPanel
          item={selectedItem}
          config={config}
          onClose={() => setSelectedItem(null)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {showForm && (
        <FormModal
          config={config}
          item={editItem}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
