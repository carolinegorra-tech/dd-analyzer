'use client';

import React, { useState, useRef } from 'react';

export default function Page() {
  const [documents, setDocuments] = useState([]);
  const [findings, setFindings] = useState({});
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef(null);

  const analyzeDocument = async (file) => {
    setLoading(true);
    const docId = `doc-${Date.now()}`;
    setDocuments(prev => [...prev, { id: docId, name: file.name, status: 'analyzing', date: new Date().toLocaleDateString() }]);
    setSelectedDoc(docId);
    try {
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      const mimeType = file.type || 'application/octet-stream';
      const systemPrompt = `You are an expert M&A due diligence analyst. Analyze documents and return ONLY valid JSON (no markdown, no code blocks):
{"documentType":"inferred type","executiveSummary":"2-3 sentence summary","risks":[{"title":"string","severity":"critical|high|medium","description":"string","citation":"section reference"}],"redFlags":[{"title":"string","description":"string","citation":"location","implication":"deal impact"}],"findings":[{"title":"string","impact":"quantified impact","recommendation":"action"}],"dealImpact":{"valuation":"impact","timeline":"effect","conditions":"required"},"confidence":"high|medium|low"}`;
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: systemPrompt,
          messages: [{ role: 'user', content: [
            { type: 'document', source: { type: 'base64', media_type: mimeType, data: base64Data } },
            { type: 'text', text: 'Analyze for M&A due diligence. Return JSON only.' }
          ]}]
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'API failed');
      const analysisText = data.content[0].text;
      const cleanJson = analysisText.replace(/```json|```/g, '').trim();
      const analysis = JSON.parse(cleanJson);
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: 'done' } : d));
      setFindings(prev => ({ ...prev, [docId]: analysis }));
    } catch (error) {
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: 'error' } : d));
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => { e.preventDefault(); Array.from(e.dataTransfer.files).forEach(f => analyzeDocument(f)); };
  const handleFileSelect = (e) => { Array.from(e.target.files).forEach(f => analyzeDocument(f)); };
  const removeDocument = (docId, e) => {
    e.stopPropagation();
    setDocuments(prev => prev.filter(d => d.id !== docId));
    const nf = { ...findings }; delete nf[docId]; setFindings(nf);
    if (selectedDoc === docId) setSelectedDoc(null);
  };

  const exportReport = () => {
    if (!selectedDoc || !findings[selectedDoc]) return;
    const doc = documents.find(d => d.id === selectedDoc);
    const a = findings[selectedDoc];
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>DD Report</title><style>
body{font-family:Georgia,serif;max-width:820px;margin:48px auto;padding:0 48px;color:#111;line-height:1.6}
h1{font-size:26px;border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:6px}
.meta{font-family:monospace;font-size:12px;color:#666;margin-bottom:32px}
h2{font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#888;margin:32px 0 12px;border-bottom:1px solid #eee;padding-bottom:6px}
.summary{font-size:16px;background:#f8f8f6;padding:18px;border-left:3px solid #111;margin-bottom:8px}
.item{border-left:3px solid #c0392b;padding:6px 0 6px 16px;margin-bottom:18px}
.item.amber{border-left-color:#b7770d}.item.gray{border-left-color:#888}
.title{font-weight:bold;font-size:15px;margin-bottom:4px}
.badge{display:inline-block;font-size:10px;font-family:monospace;padding:1px 6px;background:#fdecea;color:#c0392b;margin-left:8px;text-transform:uppercase}
.badge.high{background:#fef0e6;color:#b7770d}.badge.medium{background:#fefce6;color:#7d6b0a}
.desc{font-size:14px;margin:4px 0}.cite{font-size:12px;color:#999;font-style:italic;margin-top:4px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #ddd;margin-top:8px}
.cell{padding:14px;border-right:1px solid #ddd}.cell:last-child{border-right:none}
.clabel{font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#999;margin-bottom:4px}
.cval{font-size:13px}
@media print{body{margin:24px;padding:0 24px}}
</style></head><body>
<h1>Due Diligence Analysis Report</h1>
<div class="meta">Document: ${doc.name} &nbsp;|&nbsp; Date: ${doc.date} &nbsp;|&nbsp; Type: ${a.documentType} &nbsp;|&nbsp; Confidence: ${(a.confidence||'').toUpperCase()}</div>
<h2>Executive Summary</h2><div class="summary">${a.executiveSummary}</div>
${a.risks?.length ? `<h2>Key Risks — ${a.risks.length} identified</h2>${a.risks.map(r=>`<div class="item"><div class="title">${r.title}<span class="badge ${r.severity}">${r.severity}</span></div><div class="desc">${r.description}</div><div class="cite">§ ${r.citation}</div></div>`).join('')}` : ''}
${a.redFlags?.length ? `<h2>Red Flags — ${a.redFlags.length} identified</h2>${a.redFlags.map(f=>`<div class="item"><div class="title">${f.title}</div><div class="desc">${f.description}</div><div class="desc"><b>Implication:</b> ${f.implication}</div><div class="cite">§ ${f.citation}</div></div>`).join('')}` : ''}
${a.findings?.length ? `<h2>Critical Findings — ${a.findings.length} identified</h2>${a.findings.map(f=>`<div class="item amber"><div class="title">${f.title}</div><div class="desc"><b>Impact:</b> ${f.impact}</div><div class="desc"><b>Action:</b> ${f.recommendation}</div></div>`).join('')}` : ''}
<h2>Deal Impact Assessment</h2><div class="grid">
<div class="cell"><div class="clabel">Valuation</div><div class="cval">${a.dealImpact?.valuation}</div></div>
<div class="cell"><div class="clabel">Timeline</div><div class="cval">${a.dealImpact?.timeline}</div></div>
<div class="cell"><div class="clabel">Conditions</div><div class="cval">${a.dealImpact?.conditions}</div></div>
</div></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    setTimeout(() => { win?.print(); }, 600);
  };

  const currentAnalysis = selectedDoc ? findings[selectedDoc] : null;
  const risks = currentAnalysis?.risks?.filter(r => !searchTerm || r.title.toLowerCase().includes(searchTerm.toLowerCase()) || r.description.toLowerCase().includes(searchTerm.toLowerCase())) || [];
  const flags = currentAnalysis?.redFlags?.filter(f => !searchTerm || f.title.toLowerCase().includes(searchTerm.toLowerCase()) || f.description.toLowerCase().includes(searchTerm.toLowerCase())) || [];

  const sevColor = (s) => s === 'critical' ? '#c0392b' : s === 'high' ? '#b7770d' : '#7d6b0a';
  const sevBg = (s) => s === 'critical' ? '#fdecea' : s === 'high' ? '#fef0e6' : '#fefce6';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: 260, background: '#141c25', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '28px 20px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ color: '#ffffff', fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', marginBottom: 4 }}>Due Diligence</div>
          <div style={{ color: '#5a7a8a', fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Document Review</div>
        </div>

        {/* Upload Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          style={{ border: '1.5px dashed #2a3f52', borderRadius: 8, padding: '20px 12px', textAlign: 'center', cursor: 'pointer', marginBottom: 20, transition: 'border-color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#d65b52'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#2a3f52'}
        >
          <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} style={{ display: 'none' }} accept=".pdf,.docx,.doc,.xlsx,.xls,.txt" />
          <div style={{ color: '#4a6a7a', fontSize: 22, marginBottom: 6 }}>↑</div>
          <div style={{ color: '#8aabb8', fontSize: 12, fontWeight: 500 }}>Upload documents</div>
          <div style={{ color: '#4a6a7a', fontSize: 11, marginTop: 3 }}>PDF · DOCX · XLSX</div>
        </div>

        {/* Document List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {documents.length === 0 ? (
            <div style={{ color: '#3a5566', fontSize: 12, textAlign: 'center', paddingTop: 12 }}>No documents filed</div>
          ) : (
            documents.map(doc => (
              <div
                key={doc.id}
                onClick={() => setSelectedDoc(doc.id)}
                style={{
                  padding: '10px 12px', borderRadius: 6, cursor: 'pointer', marginBottom: 4, position: 'relative',
                  background: selectedDoc === doc.id ? '#1e2f3f' : 'transparent',
                  border: selectedDoc === doc.id ? '1px solid #2e4a5e' : '1px solid transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 18 }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: doc.status === 'done' ? '#2ecc8a' : doc.status === 'error' ? '#e05a50' : '#f0a030',
                    boxShadow: doc.status === 'analyzing' ? '0 0 0 3px rgba(240,160,48,0.2)' : 'none'
                  }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#d0e0ea', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                    <div style={{ color: '#4a6a7a', fontSize: 10, fontFamily: 'monospace', marginTop: 2 }}>{doc.date}</div>
                  </div>
                </div>
                <button
                  onClick={(e) => removeDocument(doc.id, e)}
                  style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#3a5566', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 2 }}
                  onMouseEnter={e => e.currentTarget.style.color = '#e05a50'}
                  onMouseLeave={e => e.currentTarget.style.color = '#3a5566'}
                >×</button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Panel */}
      <div style={{ flex: 1, background: '#f7f5f0', overflowY: 'auto' }}>
        {!selectedDoc ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', color: '#999', gap: 12 }}>
            <div style={{ fontSize: 40, opacity: 0.3 }}>⊞</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#666' }}>No document selected</div>
            <div style={{ fontSize: 14, color: '#999' }}>Upload a document to begin analysis</div>
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 28, height: 28, border: '2px solid #ddd', borderTopColor: '#c0392b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontSize: 14, color: '#888' }}>Analyzing document…</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : currentAnalysis ? (
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 48px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid #e0ddd6' }}>
              <div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#999', marginBottom: 6 }}>{currentAnalysis.documentType}</div>
                <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1a1a1a', margin: 0, lineHeight: 1.3 }}>{documents.find(d => d.id === selectedDoc)?.name}</h1>
                <div style={{ display: 'flex', gap: 16, marginTop: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#999' }}>Confidence:</span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, padding: '2px 8px', borderRadius: 3,
                    background: currentAnalysis.confidence === 'high' ? '#e6f4ec' : currentAnalysis.confidence === 'medium' ? '#fef0e6' : '#fdecea',
                    color: currentAnalysis.confidence === 'high' ? '#1a7a40' : currentAnalysis.confidence === 'medium' ? '#b7770d' : '#c0392b'
                  }}>{(currentAnalysis.confidence || '').toUpperCase()}</span>
                </div>
              </div>
              <button
                onClick={exportReport}
                style={{ background: '#141c25', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.background = '#c0392b'}
                onMouseLeave={e => e.currentTarget.style.background = '#141c25'}
              >↓ Export PDF</button>
            </div>

            {/* Search */}
            <div style={{ marginBottom: 28 }}>
              <input
                type="text" placeholder="Search findings…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, background: '#fff', color: '#1a1a1a', boxSizing: 'border-box' }}
              />
            </div>

            {/* Executive Summary */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#999', marginBottom: 12 }}>Executive Summary</div>
              <div style={{ fontSize: 16, lineHeight: 1.7, color: '#2a2520', fontFamily: 'Georgia, serif', padding: '18px 20px', background: '#fff', borderLeft: '3px solid #141c25', borderRadius: '0 6px 6px 0' }}>
                {currentAnalysis.executiveSummary}
              </div>
            </div>

            {/* Risks */}
            {risks.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#999' }}>Key Risks</div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', background: '#f0ece4', color: '#888', padding: '1px 8px', borderRadius: 10 }}>{risks.length}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {risks.map((risk, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '16px 18px', borderLeft: `3px solid ${sevColor(risk.severity)}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>{risk.title}</div>
                        <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, padding: '2px 8px', borderRadius: 3, background: sevBg(risk.severity), color: sevColor(risk.severity), flexShrink: 0, marginLeft: 12 }}>{(risk.severity||'').toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: 14, color: '#444', lineHeight: 1.6, marginBottom: 8 }}>{risk.description}</div>
                      <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#aaa', fontStyle: 'italic' }}>§ {risk.citation}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Red Flags */}
            {flags.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#999' }}>Red Flags</div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', background: '#f0ece4', color: '#888', padding: '1px 8px', borderRadius: 10 }}>{flags.length}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {flags.map((flag, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '16px 18px', borderLeft: '3px solid #c0392b' }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a', marginBottom: 8 }}>{flag.title}</div>
                      <div style={{ fontSize: 14, color: '#444', lineHeight: 1.6, marginBottom: 6 }}>{flag.description}</div>
                      <div style={{ fontSize: 14, color: '#444', lineHeight: 1.6, marginBottom: 8 }}><span style={{ fontWeight: 600 }}>Implication:</span> {flag.implication}</div>
                      <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#aaa', fontStyle: 'italic' }}>§ {flag.citation}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Critical Findings */}
            {currentAnalysis.findings?.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#999' }}>Critical Findings</div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', background: '#f0ece4', color: '#888', padding: '1px 8px', borderRadius: 10 }}>{currentAnalysis.findings.length}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {currentAnalysis.findings.map((f, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '16px 18px', borderLeft: '3px solid #b7770d' }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a', marginBottom: 8 }}>{f.title}</div>
                      <div style={{ fontSize: 14, color: '#444', lineHeight: 1.6, marginBottom: 6 }}><span style={{ fontWeight: 600 }}>Impact:</span> {f.impact}</div>
                      <div style={{ fontSize: 14, color: '#444', lineHeight: 1.6 }}><span style={{ fontWeight: 600 }}>Action:</span> {f.recommendation}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Deal Impact */}
            <div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#999', marginBottom: 14 }}>Deal Impact Assessment</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: '#e0ddd6', borderRadius: 8, overflow: 'hidden' }}>
                {[
                  { label: 'Valuation', value: currentAnalysis.dealImpact?.valuation },
                  { label: 'Timeline', value: currentAnalysis.dealImpact?.timeline },
                  { label: 'Required Conditions', value: currentAnalysis.dealImpact?.conditions },
                ].map((cell, i) => (
                  <div key={i} style={{ background: '#fff', padding: '18px 20px' }}>
                    <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa', marginBottom: 8 }}>{cell.label}</div>
                    <div style={{ fontSize: 14, color: '#2a2520', lineHeight: 1.5 }}>{cell.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
