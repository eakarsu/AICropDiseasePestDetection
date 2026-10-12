import React from 'react';

export default function FullFieldPresets({ value, onChange, presets = [], disabled = false }) {
  return <div className="ai-preset-bar"><div><strong>Fill every field</strong><p>Each example fills required and optional fields. Review and edit before generating.</p></div><div className="ai-actions">{presets.map((preset) => <button type="button" className="btn btn-secondary" key={preset.label} disabled={disabled} onClick={() => onChange({ ...value, ...preset.values })}>{preset.label}</button>)}</div></div>;
}
