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
        <input type="password" value={pwInput} onChange={e => setPwInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') checkPassword(); }} placeholder="Password"
          style={{ width: '100%', padding: '11px 14px', borderRadius: 7, border: '1px solid #1e3a50', background: '#0f1923', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, marginBottom: 12 }} autoFocus />
        <button onClick={checkPassword} style={{ width: '100%', padding: '11px', background: '#c0392b', color: '#fff', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Continue</button>
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
      const systemPrompt = 'You are an expert M&A due diligence analyst. Analyze documents and return ONLY valid JSON (no markdown, no code blocks): {"documentType":"inferred type","executiveSummary":"2-3 sentence summary","projectName":"inferred project/company name or Unknown","risks":[{"title":"string","severity":"critical|high|medium","description":"string","citation":"section reference","category":"Corporate|Financial|Commercial|IP|DataPrivacy|RealEstate|Insurance|Environmental|Regulatory|Tax|Labor|Litigation|Other"}],"redFlags":[{"title":"string","description":"string","citation":"location","implication":"deal impact","category":"Corporate|Financial|Commercial|IP|DataPrivacy|RealEstate|Insurance|Environmental|Regulatory|Tax|Labor|Litigation|Other"}],"findings":[{"title":"string","impact":"quantified impact","recommendation":"action","category":"Corporate|Financial|Commercial|IP|DataPrivacy|RealEstate|Insurance|Environmental|Regulatory|Tax|Labor|Litigation|Other"}],"dealImpact":{"valuation":"impact","timeline":"effect","conditions":"required"},"confidence":"high|medium|low","scopeSummary":"1-2 sentence summary of what was reviewed","keyObservations":"2-3 overall observations about the document"}';
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

  const generateFullReport = () => {
    if (!selectedDoc || !findings[selectedDoc]) return;
    const doc = documents.find(d => d.id === selectedDoc);
    const a = findings[selectedDoc];
    const date = doc.date;
    const project = a.projectName || 'Target Company';

    const categories = ['Corporate', 'Financial', 'Commercial', 'IP', 'DataPrivacy', 'RealEstate', 'Insurance', 'Environmental', 'Regulatory', 'Tax', 'Labor', 'Litigation', 'Other'];
    const categoryLabels = { Corporate: 'Corporate', Financial: 'Financial Agreements', Commercial: 'Commercial Agreements', IP: 'Intellectual Property', DataPrivacy: 'Data Privacy', RealEstate: 'Real Estate', Insurance: 'Insurance', Environmental: 'Environmental', Regulatory: 'Regulatory', Tax: 'Tax', Labor: 'Labor', Litigation: 'Civil Litigation', Other: 'Other Matters' };

    const allIssues = [
      ...(a.risks || []).map(r => ({ ...r, type: 'risk' })),
      ...(a.redFlags || []).map(f => ({ ...f, type: 'flag' })),
      ...(a.findings || []).map(f => ({ ...f, type: 'finding' }))
    ];

    const byCategory = {};
    categories.forEach(cat => {
      byCategory[cat] = allIssues.filter(i => i.category === cat);
    });

    const sevBadge = (s) => {
      const colors = { critical: '#c0392b', high: '#b7770d', medium: '#7d6b0a' };
      const bgs = { critical: '#fdecea', high: '#fef0e6', medium: '#fefce6' };
      return `<span style="display:inline-block;font-size:10px;font-family:monospace;font-weight:700;padding:2px 8px;border-radius:3px;background:${bgs[s]||'#f0f0f0'};color:${colors[s]||'#888'};text-transform:uppercase;letter-spacing:0.04em;margin-left:8px">${s||''}</span>`;
    };

    const typeLabel = (t) => t === 'risk' ? 'KEY RISK' : t === 'flag' ? 'RED FLAG' : 'FINDING';
    const typeBg = (t) => t === 'flag' ? '#fdecea' : t === 'risk' ? '#fef5f5' : '#fdf9f0';

    let categorySections = '';
    let tocRows = '';
    let sectionNum = 1;

    categories.forEach(cat => {
      const items = byCategory[cat];
      if (!items || items.length === 0) return;
      const label = categoryLabels[cat];
      tocRows += `<tr><td style="padding:6px 12px;font-size:13px;color:#333">${sectionNum}. ${label}</td><td style="padding:6px 12px;font-size:13px;color:#999;text-align:right">${items.length} issue${items.length > 1 ? 's' : ''}</td></tr>`;
      categorySections += `
        <div style="margin-bottom:40px;page-break-inside:avoid">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #0f1923">
            <div style="width:28px;height:28px;background:#0f1923;border-radius:5px;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;font-family:monospace;flex-shrink:0">${sectionNum}</div>
            <h2 style="margin:0;font-size:16px;font-weight:700;color:#0f1923;font-family:Arial,sans-serif;letter-spacing:-0.01em">${label}</h2>
          </div>
          ${items.map(item => `
            <div style="background:#fff;border-radius:8px;padding:16px 18px;border-left:3px solid ${item.type === 'flag' ? '#c0392b' : item.type === 'risk' ? '#b7770d' : '#7d6b0a'};margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                <div style="font-weight:600;font-size:14px;color:#1a1612;line-height:1.3;flex:1">${item.title}</div>
                <div style="display:flex;gap:6px;flex-shrink:0;margin-left:12px">
                  <span style="font-size:10px;font-family:monospace;padding:2px 7px;border-radius:3px;background:#e8e4dc;color:#666;font-weight:600">${typeLabel(item.type)}</span>
                  ${item.severity ? sevBadge(item.severity) : ''}
                </div>
              </div>
              <div style="font-size:13px;color:#4a4540;line-height:1.65;margin-bottom:8px">${item.description || item.impact || ''}</div>
              ${item.implication ? `<div style="font-size:13px;color:#4a4540;padding:8px 12px;background:#fdf9f8;border-radius:5px;margin-bottom:8px"><span style="font-weight:600;color:#c0392b">Implication: </span>${item.implication}</div>` : ''}
              ${item.recommendation ? `<div style="font-size:13px;color:#4a4540;padding:8px 12px;background:#f4f8f4;border-radius:5px;margin-bottom:8px"><span style="font-weight:600;color:#2c6e49">Recommended Action: </span>${item.recommendation}</div>` : ''}
              ${item.citation ? `<div style="font-size:11px;font-family:monospace;color:#b0aa9a;font-style:italic;margin-top:6px">§ ${item.citation}</div>` : ''}
            </div>
          `).join('')}
        </div>`;
      sectionNum++;
    });

    const criticalCount = allIssues.filter(i => i.severity === 'critical').length;
    const highCount = allIssues.filter(i => i.severity === 'high').length;
    const mediumCount = allIssues.filter(i => i.severity === 'medium').length;

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Due Diligence Report — ${project}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, serif; margin: 0; padding: 0; background: #f6f4ef; color: #1a1612; line-height: 1.6; }
  .page { max-width: 860px; margin: 0 auto; background: #fff; }
  @media print {
    body { background: #fff; }
    .page { max-width: none; box-shadow: none; }
    .no-print { display: none !important; }
    .pagebreak { page-break-before: always; }
  }
  .print-btn { position: fixed; top: 20px; right: 20px; background: #0f1923; color: white; border: none; padding: 10px 18px; border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: Arial, sans-serif; z-index: 999; }
  .print-btn:hover { background: #c0392b; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">↓ Save as PDF</button>
<div class="page">

  <!-- Cover Page -->
  <div style="min-height:100vh;background:#0f1923;display:flex;flex-direction:column;justify-content:space-between;padding:80px 72px;position:relative">
    <div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:80px">
        <div style="width:36px;height:36px;background:#c0392b;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;color:white;font-weight:700;font-family:Arial">D</div>
        <div style="color:#5a7a8a;font-family:monospace;font-size:12px;text-transform:uppercase;letter-spacing:0.1em">Due Diligence AI</div>
      </div>
      <div style="color:#3a5a6a;font-family:monospace;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:16px">Confidential — Attorney Work Product</div>
      <h1 style="font-family:Arial,sans-serif;font-size:42px;font-weight:700;color:#ffffff;margin:0 0 12px;line-height:1.15;letter-spacing:-0.02em">${project}</h1>
      <div style="font-family:Arial,sans-serif;font-size:20px;color:#7aabb8;font-weight:400;margin-bottom:48px">Due Diligence Analysis Report</div>
      <div style="width:48px;height:3px;background:#c0392b;margin-bottom:48px"></div>
      <div style="color:#5a7a8a;font-family:monospace;font-size:12px;line-height:2">
        Document reviewed: ${doc.name}<br>
        Analysis date: ${date}<br>
        Document type: ${a.documentType || 'N/A'}<br>
        Confidence level: ${(a.confidence || '').toUpperCase()}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#1e3040;border-radius:8px;overflow:hidden">
      <div style="background:#162635;padding:20px 24px">
        <div style="font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#3a5a6a;margin-bottom:6px">Critical Issues</div>
        <div style="font-size:28px;font-weight:700;color:#c0392b;font-family:Arial">${criticalCount}</div>
      </div>
      <div style="background:#162635;padding:20px 24px">
        <div style="font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#3a5a6a;margin-bottom:6px">High Priority</div>
        <div style="font-size:28px;font-weight:700;color:#b7770d;font-family:Arial">${highCount}</div>
      </div>
      <div style="background:#162635;padding:20px 24px">
        <div style="font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#3a5a6a;margin-bottom:6px">Total Findings</div>
        <div style="font-size:28px;font-weight:700;color:#7aabb8;font-family:Arial">${allIssues.length}</div>
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <div style="padding:56px 72px">

    <!-- A. Introduction -->
    <div style="margin-bottom:48px">
      <div style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#b0aa9a;margin-bottom:6px">Section A</div>
      <h2 style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:#0f1923;margin:0 0 20px;padding-bottom:12px;border-bottom:2px solid #0f1923">Introduction</h2>
      <p style="font-size:15px;color:#3a3530;line-height:1.75;margin:0 0 16px">${a.executiveSummary}</p>
      ${a.keyObservations ? `<p style="font-size:15px;color:#3a3530;line-height:1.75;margin:0">${a.keyObservations}</p>` : ''}
    </div>

    <!-- B. Scope -->
    <div style="margin-bottom:48px">
      <div style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#b0aa9a;margin-bottom:6px">Section B</div>
      <h2 style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:#0f1923;margin:0 0 20px;padding-bottom:12px;border-bottom:2px solid #0f1923">Scope of Works</h2>
      <p style="font-size:15px;color:#3a3530;line-height:1.75;margin:0 0 16px">${a.scopeSummary || 'This report covers a review of the document provided, identifying key risks, red flags, and critical findings relevant to the proposed transaction.'}</p>
      <div style="background:#f6f4ef;border-radius:8px;padding:20px 24px">
        <div style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#b0aa9a;margin-bottom:12px">Areas Reviewed</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          ${categories.filter(cat => byCategory[cat]?.length > 0).map(cat => `<div style="font-size:13px;color:#3a3530;padding:6px 10px;background:#fff;border-radius:5px;border:1px solid #e8e4dc">${categoryLabels[cat]}</div>`).join('')}
        </div>
      </div>
    </div>

    <!-- C. Risk Summary Table -->
    <div style="margin-bottom:48px">
      <div style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#b0aa9a;margin-bottom:6px">Section C</div>
      <h2 style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:#0f1923;margin:0 0 20px;padding-bottom:12px;border-bottom:2px solid #0f1923">Summary of Findings</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#0f1923;color:#fff">
            <th style="padding:10px 14px;text-align:left;font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">Area</th>
            <th style="padding:10px 14px;text-align:center;font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">Issues</th>
            <th style="padding:10px 14px;text-align:center;font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">Critical</th>
            <th style="padding:10px 14px;text-align:center;font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">High</th>
          </tr>
        </thead>
        <tbody>
          ${categories.filter(cat => byCategory[cat]?.length > 0).map((cat, i) => {
            const items = byCategory[cat];
            const crit = items.filter(x => x.severity === 'critical').length;
            const high = items.filter(x => x.severity === 'high').length;
            return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9f7f4'}">
              <td style="padding:10px 14px;color:#333;border-bottom:1px solid #eee">${categoryLabels[cat]}</td>
              <td style="padding:10px 14px;text-align:center;color:#333;border-bottom:1px solid #eee;font-family:monospace;font-weight:600">${items.length}</td>
              <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #eee">${crit > 0 ? `<span style="background:#fdecea;color:#c0392b;font-family:monospace;font-weight:700;padding:2px 8px;border-radius:3px">${crit}</span>` : '—'}</td>
              <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #eee">${high > 0 ? `<span style="background:#fef0e6;color:#b7770d;font-family:monospace;font-weight:700;padding:2px 8px;border-radius:3px">${high}</span>` : '—'}</td>
            </tr>`;
          }).join('')}
          <tr style="background:#f0ede6;font-weight:600">
            <td style="padding:10px 14px;color:#0f1923;font-family:Arial;font-size:13px">TOTAL</td>
            <td style="padding:10px 14px;text-align:center;color:#0f1923;font-family:monospace;font-weight:700">${allIssues.length}</td>
            <td style="padding:10px 14px;text-align:center"><span style="background:#c0392b;color:#fff;font-family:monospace;font-weight:700;padding:2px 8px;border-radius:3px">${criticalCount}</span></td>
            <td style="padding:10px 14px;text-align:center"><span style="background:#b7770d;color:#fff;font-family:monospace;font-weight:700;padding:2px 8px;border-radius:3px">${highCount}</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- D. Deal Impact -->
    <div style="margin-bottom:48px">
      <div style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#b0aa9a;margin-bottom:6px">Section D</div>
      <h2 style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:#0f1923;margin:0 0 20px;padding-bottom:12px;border-bottom:2px solid #0f1923">Deal Impact Assessment</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
        ${[{ label: 'Valuation Impact', value: a.dealImpact?.valuation }, { label: 'Timeline Effect', value: a.dealImpact?.timeline }, { label: 'Required Conditions', value: a.dealImpact?.conditions }].map(cell => `
          <div style="background:#f6f4ef;border-radius:8px;padding:18px 20px;border:1px solid #e8e4dc">
            <div style="font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#b0aa9a;margin-bottom:8px">${cell.label}</div>
            <div style="font-size:14px;color:#1a1612;line-height:1.6;font-weight:500">${cell.value || '—'}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- E. Detailed Findings -->
    <div style="margin-bottom:48px">
      <div style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#b0aa9a;margin-bottom:6px">Section E</div>
      <h2 style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:#0f1923;margin:0 0 28px;padding-bottom:12px;border-bottom:2px solid #0f1923">Detailed Findings by Category</h2>
      ${categorySections}
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #e8e4dc;padding-top:24px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-family:monospace;font-size:11px;color:#b0aa9a">Due Diligence AI — Confidential</div>
      <div style="font-family:monospace;font-size:11px;color:#b0aa9a">${date}</div>
    </div>

  </div>
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const exportQuickReport = () => {
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#999' }}>CONFIDENCE</span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, padding: '3px 10px', borderRadius: 4, background: currentAnalysis.confidence === 'high' ? '#e4f5ec' : currentAnalysis.confidence === 'medium' ? '#fef0e6' : '#fdecea', color: currentAnalysis.confidence === 'high' ? '#1a7a40' : currentAnalysis.confidence === 'medium' ? '#b7770d' : '#c0392b' }}>{(currentAnalysis.confidence || '').toUpperCase()}</span>
                </div>
                <button onClick={exportQuickReport} style={{ background: '#f0ece4', color: '#555', border: 'none', borderRadius: 7, padding: '9px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#e0dcd4'}
                  onMouseLeave={e => e.currentTarget.style.background = '#f0ece4'}>↓ Quick PDF</button>
                <button onClick={generateFullReport} style={{ background: '#0f1923', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.02em' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#c0392b'}
                  onMouseLeave={e => e.currentTarget.style.background = '#0f1923'}>📄 Generate Full Report</button>
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
                      { label: 'Valuation Impact', value: currentAnalysis.dealImpact?.valuation },
                      { label: 'Timeline Effect', value: currentAnalysis.dealImpact?.timeline },
                      { label: 'Required Conditions', value: currentAnalysis.dealImpact?.conditions },
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
