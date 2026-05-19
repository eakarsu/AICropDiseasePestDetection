// frontend/src/pages/CustomViewsPage.js
// Field Analytics — wraps PestSpreadMap + DiseaseSeverity. Imports leaflet CSS once here.

import React from 'react';
import 'leaflet/dist/leaflet.css';

import PestSpreadMap from '../components/PestSpreadMap';
import DiseaseSeverity from '../components/DiseaseSeverity';
import TreatmentPlanExporter from '../components/TreatmentPlanExporter';
import FieldReportUpload from '../components/FieldReportUpload';

export default function CustomViewsPage() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, color: '#14532d' }}>Field Analytics</h1>
        <p style={{ margin: '6px 0 0', color: '#475569' }}>
          Geographic pest spread and disease severity at a glance — synthesized from your live detections + alerts.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
        <PestSpreadMap />
        <DiseaseSeverity />
        <TreatmentPlanExporter />
        <FieldReportUpload />
      </div>
    </div>
  );
}
