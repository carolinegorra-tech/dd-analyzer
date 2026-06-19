'use client';

import React, { useState, useRef } from 'react';

function getMimeType(fileName: string, fileType: string): string {
  const name = fileName.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (name.endsWith('.doc')) return 'application/msword';
  if (name.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (name.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (name.endsWith('.txt')) return 'text/plain';
  if (fileType) return fileType;
  return 'application/octet-stream';
}

const SEV_COLOR = { critical: '#c0392b', high: '#b7770d', medium: '#7d6b0a' };
const SEV_BG = { critical: '#fdecea', high: '#fef0e6', medium: '#fefce6' };

export default function Page() {
  const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [documents, setDocuments] = useState([]);
  const [findings, setFindings] = useState({});
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('risks');
  const fileInputRef = useRef(null);

  const checkPassword = () => {
    if (pwInput === 'machado') setUnlocked(true);
    else alert('Incorrect password');
  };

  if (!unlocked) return (
    <div style={{ minHeight: '100vh', background: '#0f1923', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#162635', borderRadius: 12, padding: '40px 48px', width: 340, border: '1px solid #1e3a50' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 32, height: 32, background: '#c0392b', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: 'white', fontWeight: 700 }}>D</div>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>Due Diligence AI</div>
        </div>
        <div style={{ fontSize: 13, color: '#5a7a8a', fontFamily: 'monospace', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 20 }}>Enter password to continue</div>
        <input
          type="password" value={pwInput} onChange={e => setPwInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') checkPassword(); }}
          placeholder="Password"
          style={{ width: '100%', padding: '11px 14px', borderRadius: 7, border: '1px solid #1e3a50', background: '#0f1923', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, marginBottom: 12 }}
          autoFocus
        />
        <button onClick={checkPassword} style={{ width: '100%', padding: '11px', background: '#c0392b', color: '#fff', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Continue
        </button>
      </div>
    </div>
  );

  const analyzeDocument = async (file) => {
    setLoading(true);
    const docId = 'doc-' + Date.now();
    setDocuments(prev => [...prev, { id: docId, name: file.name, status: 'analyzing', date: new Date().toLocaleDateString() }]);
    setSelectedDoc(docId);
    setActiveTab('risks');
    try {
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      const mimeType = getMimeType(file.name, file.type);
      const systemPrompt = 'You are an expert M&A due diligence analyst. Analyze documents and return ONLY valid JSON (no markdown, no code blocks): {"documentType":"inferred type","executiveSummary":"2-3 sentence summary","risks":[{"title":"string","severity":"critical|high|medium","description":"string","citation":"section reference"}],"redFlags":[{"title":"string","description":"string","citation":"location","implication":"deal impact"}],"findings":[{"title":"string","impact":"quantified impact","recommendation":"action"}],"dealImpact":{"valuation":"impact","timeline":"effect","conditions":"required"},"confidence":"high|medium|low"}';
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
      if (!data.content || !data.content[0]) throw new Error('mime=' + mimeType + ' name=' + file.name + ' resp=' + JSON.stringify(data));
      const txt = data.content[0].text;
      const clean = txt.replace(/```json|```/g, '').trim();
      const analysis = JSON.parse(clean);
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: 'done' } : d));
      setFindings(prev => ({ ...prev, [docId]: analysis }));
    } catch (error) {
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: 'error' } : d));
      alert('Error: ' + error.message);
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
    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>DD Report</title><style>body{font-family:Georgia,serif;max-width:820px;margin:48px auto;padding:0 48px;color:#111;line-height:1.6}h1{font-size:26px;border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:6px}.meta{font-family:monospace;font-size:12px;color:#666;margin-bottom:32px}h2{font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#888;margin:32px 0 12px;border-bottom:1px solid #eee;padding-bottom:6px}.summary{font-size:16px;background:#f8f8f6;padding:18px;border-left:3px solid #111;margin-bottom:8px}.item{border-left:3px solid #c0392b;padding:6px 0 6px 16px;margin-bottom:18px}.item.amber{border-left-color:#b7770d}.title{font-weight:bold;font-size:15px;margin-bottom:4px}.badge{display:inline-block;font-size:10px;font-family:monospace;padding:1px 6px;background:#fdecea;color:#c0392b;margin-left:8px;text-transform:uppercase}.desc{font-size:14px;margin:4px 0}.cite{font-size:12px;color:#999;font-style:italic;margin-top:4px}.grid{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #ddd;margin-top:8px}.cell{padding:14px;border-right:1px solid #ddd}.cell:last-child{border-right:none}.clabel{font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#999;margin-bottom:4px}@media print{body{margin:24px;padding:0 24px}}</style></head><body><h1>Due Diligence Analysis Report</h1><div class="meta">Document: ' + doc.name + ' | Date: ' + doc.date + ' | Type: ' + a.documentType + ' | Confidence: ' + (a.confidence||'').toUpperCase() + '</div><h2>Executive Summary</h2><div class="summary">' + a.executiveSummary + '</div>' + (a.risks?.length ? '<h2>Key Risks</h2>' + a.risks.map(r => '<div class="item"><div class="title">' + r.title + ' <span class="badge">' + r.severity + '</span></div><div class="desc">' + r.description + '</div><div class="cite">' + r.citation + '</div></div>').join('') : '') + (a.redFlags?.length ? '<h2>Red Flags</h2>' + a.redFlags.map(f => '<div class="item"><div class="title">' + f.title + '</div><div class="desc">' + f.description + '</div><div class="desc"><b>Implication:</b> ' + f.implication + '</div><div class="cite">' + f.citation + '</div></div>').join('') : '') + (a.findings?.length ? '<h2>Critical Findings</h2>' + a.findings.map(f => '<div class="item amber"><div class="title">' + f.title + '</div><div class="desc"><b>Impact:</b> ' + f.impact + '</div><div class="desc"><b>Action:</b> ' + f.recommendation + '</div></div>').join('') : '') + '<h2>Deal Impact</h2><div class="grid"><div class="cell"><div class="clabel">Valuation</div>' + (a.dealImpact?.valuation||'') + '</div><div class="cell"><div class="clabel">Timeline</div>' + (a.dealImpact?.timeline||'') + '</div><div class="cell"><div class="clabel">Conditions</div>' + (a.dealImpact?.conditions||'') + '</div></div></body></html>';
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    setTimeout(() => { if (win) win.print(); }, 600);
  };

  const currentAnalysis = selectedDoc ? findings[selectedDoc] : null;
  const tabs = currentAnalysis ? [
    { id: 'risks', label: 'Key Risks', count: currentAnalysis.risks?.length || 0, color: '#c0392b' },
    { id: 'flags', label: 'Red Flags', count: currentAnalysis.redFlags?.length || 0, color: '#c0392b' },
    { id: 'findings', label: 'Critical Findings', count: currentAnalysis.findings?.length || 0, color: '#b7770d' },
    { id: 'impact', label: 'Deal Impact', count: null, color: '#141c25' },
  ] : [];
  const filtered = (items) => !searchTerm ? (items || []) : (items || []).filter(r => JSON.stringify(r).toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ width: 268, background: '#0f1923', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #1a2a35' }}>
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #1a2a35' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 28, height: 28, background: '#c0392b', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'white', fontWeight: 700 }}>D</div>
            <div style={{ color: '#ffffff', fontWeight: 600, fontSize: 14 }}>Due Diligence AI</div>
          </div>
          <div style={{ color: '#3a5a6a', fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase' as const, letterSpacing: '0.08em', paddingLeft: 38 }}>M&A Document Review</div>
        </div>
        <div style={{ padding: '16px' }}>
          <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} onClick={() => fileInputRef.current?.click()}
            style={{ border: '1.5px dashed #1e3040', borderRadius: 8, padding: '16px 12px', textAlign: 'center' as const, cursor: 'pointer', background: '#0d1820' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#c0392b'; e.currentTarget.style.background = '#150d0d'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e3040'; e.currentTarget.style.background = '#0d1820'; }}>
            <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} style={{ display: 'none' }} accept=".pdf,.docx,.doc,.xlsx,.xls,.txt" />
            <div style={{ color: '#c0392b', fontSize: 18, marginBottom: 5 }}>↑</div>
            <div style={{ color: '#7aabb8', fontSize: 12, fontWeight: 500 }}>Upload document</div>
            <div style={{ color: '#3a5a6a', fontSize: 10, marginTop: 3, fontFamily: 'monospace' }}>PDF · DOCX · XLSX</div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' as const, padding: '0 16px 16px' }}>
          {documents.length > 0 && <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#2a4a5a', marginBottom: 8, paddingLeft: 4 }}>Exhibits</div>}
          {documents.length === 0 ? (
            <div style={{ color: '#2a4a5a', fontSize: 12, textAlign: 'center' as const, paddingTop: 12, fontStyle: 'italic' }}>No documents filed</div>
          ) : documents.map(doc => (
            <div key={doc.id} onClick={() => setSelectedDoc(doc.id)}
              style={{ padding: '9px 11px', borderRadius: 7, cursor: 'pointer', marginBottom: 3, position: 'relative' as const, background: selectedDoc === doc.id ? '#162635' : 'transparent', border: selectedDoc === doc.id ? '1px solid #1e3a50' : '1px solid transparent' }}
              onMouseEnter={e => { if (selectedDoc !== doc.id) e.currentTarget.style.background = '#0d1820'; }}
              onMouseLeave={e => { if (selectedDoc !== doc.id) e.currentTarget.style.background = 'transparent'; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingRight: 20 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: doc.status === 'done' ? '#27ae70' : doc.status === 'error' ? '#e05a50' : '#f0a030', boxShadow: doc.status === 'analyzing' ? '0 0 6px #f0a030' : 'none' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#c8dde8', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{doc.name}</div>
                  <div style={{ color: '#2a4a5a', fontSize: 10, fontFamily: 'monospace', marginTop: 2 }}>{doc.date}</div>
                </div>
              </div>
              <button onClick={(e) => removeDocument(doc.id, e)} style={{ position: 'absolute' as const, top: 8, right: 8, background: 'none', border: 'none', color: '#2a4a5a', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 2 }}
                onMouseEnter={e => e.currentTarget.style.color = '#e05a50'}
                onMouseLeave={e => e.currentTarget.style.color = '#2a4a5a'}>×</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, background: '#f6f4ef', overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const }}>
        {!selectedDoc ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' as const, gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#eae7e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📄</div>
            <div style={{ fontSize: 17, fontWeight: 500, color: '#555' }}>No document selected</div>
            <div style={{ fontSize: 14, color: '#aaa' }}>Upload a document from the sidebar to begin</div>
          </div>
        ) : loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' as const, gap: 18 }}>
            <div style={{ width: 44, height: 44, border: '3px solid #e0ddd6', borderTopColor: '#c0392b', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
            <div style={{ fontSize: 14, color: '#888', fontWeight: 500 }}>Analyzing document…</div>
            <div style={{ fontSize: 12, color: '#bbb' }}>This may take 20–30 seconds</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : currentAnalysis ? (
          <>
            <div style={{ background: '#fff', borderBottom: '1px solid #e8e4dc', padding: '18px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#b0aa9a', marginBottom: 4 }}>{currentAnalysis.documentType}</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1612', letterSpacing: '-0.01em' }}>{documents.find(d => d.id === selectedDoc)?.name}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#999' }}>CONFIDENCE</span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, padding: '3px 10px', borderRadius: 4, background: currentAnalysis.confidence === 'high' ? '#e4f5ec' : currentAnalysis.confidence === 'medium' ? '#fef0e6' : '#fdecea', color: currentAnalysis.confidence === 'high' ? '#1a7a40' : currentAnalysis.confidence === 'medium' ? '#b7770d' : '#c0392b' }}>{(currentAnalysis.confidence || '').toUpperCase()}</span>
                </div>
                <button onClick={exportReport} style={{ background: '#0f1923', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.02em' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#c0392b'}
                  onMouseLeave={e => e.currentTarget.style.background = '#0f1923'}>↓ Export PDF</button>
              </div>
            </div>

            <div style={{ background: '#fff', borderBottom: '1px solid #e8e4dc', padding: '16px 32px', flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#b0aa9a', marginBottom: 8 }}>Executive Summary</div>
              <div style={{ fontSize: 14, lineHeight: 1.65, color: '#3a3530', fontFamily: 'Georgia, serif' }}>{currentAnalysis.executiveSummary}</div>
            </div>

            <div style={{ background: '#fff', borderBottom: '1px solid #e8e4dc', padding: '0 32px', display: 'flex', gap: 2, flexShrink: 0, alignItems: 'center' }}>
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '13px 16px 11px', fontSize: 12, fontWeight: activeTab === tab.id ? 600 : 400, color: activeTab === tab.id ? tab.color : '#888', borderBottom: activeTab === tab.id ? '2px solid ' + tab.color : '2px solid transparent', display: 'flex', alignItems: 'center', gap: 7, marginBottom: -1, letterSpacing: '0.01em' }}>
                  {tab.label}
                  {tab.count !== null && tab.count > 0 && <span style={{ fontSize: 10, fontFamily: 'monospace', background: activeTab === tab.id ? tab.color : '#eae7e0', color: activeTab === tab.id ? '#fff' : '#888', padding: '1px 6px', borderRadius: 8, fontWeight: 600 }}>{tab.count}</span>}
                </button>
              ))}
              <div style={{ marginLeft: 'auto', padding: '8px 0' }}>
                <input type="text" placeholder="Search…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ padding: '5px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 12, background: '#f9f7f4', color: '#333', width: 160, outline: 'none' }} />
              </div>
            </div>

            <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' as const }}>
              {activeTab === 'risks' && (
                <div>
                  {filtered(currentAnalysis.risks).length === 0 ? <div style={{ color: '#aaa', fontSize: 14, textAlign: 'center' as const, paddingTop: 40 }}>No risks identified</div>
                  : filtered(currentAnalysis.risks).map((risk, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '18px 20px', borderLeft: '3px solid ' + (SEV_COLOR[risk.severity] || '#888'), marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1612', lineHeight: 1.3 }}>{risk.title}</div>
                        <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, padding: '3px 9px', borderRadius: 4, background: SEV_BG[risk.severity] || '#f0f0f0', color: SEV_COLOR[risk.severity] || '#888', flexShrink: 0, marginLeft: 12 }}>{(risk.severity||'').toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: 14, color: '#4a4540', lineHeight: 1.65, marginBottom: 10 }}>{risk.description}</div>
                      <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#b0aa9a', fontStyle: 'italic' }}>§ {risk.citation}</div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'flags' && (
                <div>
                  {filtered(currentAnalysis.redFlags).length === 0 ? <div style={{ color: '#aaa', fontSize: 14, textAlign: 'center' as const, paddingTop: 40 }}>No red flags identified</div>
                  : filtered(currentAnalysis.redFlags).map((flag, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '18px 20px', borderLeft: '3px solid #c0392b', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1612', marginBottom: 10 }}>{flag.title}</div>
                      <div style={{ fontSize: 14, color: '#4a4540', lineHeight: 1.65, marginBottom: 8 }}>{flag.description}</div>
                      <div style={{ fontSize: 14, color: '#4a4540', lineHeight: 1.65, marginBottom: 10, padding: '10px 14px', background: '#fdf9f8', borderRadius: 6 }}>
                        <span style={{ fontWeight: 600, color: '#c0392b' }}>Implication: </span>{flag.implication}
                      </div>
                      <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#b0aa9a', fontStyle: 'italic' }}>§ {flag.citation}</div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'findings' && (
                <div>
                  {filtered(currentAnalysis.findings).length === 0 ? <div style={{ color: '#aaa', fontSize: 14, textAlign: 'center' as const, paddingTop: 40 }}>No critical findings</div>
                  : filtered(currentAnalysis.findings).map((f, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '18px 20px', borderLeft: '3px solid #b7770d', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1612', marginBottom: 10 }}>{f.title}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ padding: '10px 14px', background: '#fdf9f0', borderRadius: 6 }}>
                          <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#b7770d', marginBottom: 4 }}>Impact</div>
                          <div style={{ fontSize: 13, color: '#4a4540', lineHeight: 1.5 }}>{f.impact}</div>
                        </div>
                        <div style={{ padding: '10px 14px', background: '#f4f8f4', borderRadius: 6 }}>
                          <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#2c6e49', marginBottom: 4 }}>Recommended Action</div>
                          <div style={{ fontSize: 13, color: '#4a4540', lineHeight: 1.5 }}>{f.recommendation}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'impact' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
                    {[
                      { label: 'Valuation Impact', value: currentAnalysis.dealImpact?.valuation, color: '#c0392b', bg: '#fdecea' },
                      { label: 'Timeline Effect', value: currentAnalysis.dealImpact?.timeline, color: '#b7770d', bg: '#fef0e6' },
                      { label: 'Required Conditions', value: currentAnalysis.dealImpact?.conditions, color: '#1a5276', bg: '#eaf2fb' },
                    ].map((cell, i) => (
                      <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #ece9e2' }}>
                        <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#b0aa9a', marginBottom: 8 }}>{cell.label}</div>
                        <div style={{ fontSize: 14, color: '#2a2520', lineHeight: 1.6, fontWeight: 500 }}>{cell.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #ece9e2' }}>
                    <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#b0aa9a', marginBottom: 16 }}>Risk Overview</div>
                    <div style={{ display: 'flex', gap: 24 }}>
                      {[
                        { label: 'Key Risks', count: currentAnalysis.risks?.length || 0, color: '#c0392b', bg: '#fdecea' },
                        { label: 'Red Flags', count: currentAnalysis.redFlags?.length || 0, color: '#c0392b', bg: '#fdecea' },
                        { label: 'Critical Findings', count: currentAnalysis.findings?.length || 0, color: '#b7770d', bg: '#fef0e6' },
                      ].map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: item.color, fontFamily: 'monospace' }}>{item.count}</div>
                          <div style={{ fontSize: 13, color: '#666' }}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
