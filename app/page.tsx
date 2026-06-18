'use client';

import React, { useState, useRef } from 'react';
import { AlertCircle, FileText, Download, Search, X, Loader } from 'lucide-react';

export default function Page() {
  const [documents, setDocuments] = useState([]);
  const [findings, setFindings] = useState({});
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef(null);

  const analyzeDocument = async (file) => {
    setLoading(true);
    try {
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      const mimeType = file.type || 'application/octet-stream';
      const systemPrompt = `You are an expert M&A due diligence analyst. Analyze documents and return ONLY valid JSON (no markdown, no code blocks):
{
  "documentType": "inferred type",
  "executiveSummary": "2-3 sentence summary",
  "risks": [{"title": "string", "severity": "critical|high|medium", "description": "string", "citation": "section reference"}],
  "redFlags": [{"title": "string", "description": "string", "citation": "location", "implication": "deal impact"}],
  "findings": [{"title": "string", "impact": "quantified impact", "recommendation": "action"}],
  "dealImpact": {"valuation": "impact", "timeline": "effect", "conditions": "required"},
  "confidence": "high|medium|low"
}`;

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: mimeType, data: base64Data } },
              { type: 'text', text: 'Analyze for M&A due diligence. Return JSON only.' }
            ]
          }]
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'API failed');

      const analysisText = data.content[0].text;
      const cleanJson = analysisText.replace(/```json|```/g, '').trim();
      const analysis = JSON.parse(cleanJson);

      const docId = `doc-${Date.now()}`;
      setDocuments(prev => [...prev, { id: docId, name: file.name, uploadDate: new Date().toLocaleDateString() }]);
      setFindings(prev => ({ ...prev, [docId]: analysis }));
      setSelectedDoc(docId);
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    Array.from(e.dataTransfer.files).forEach(f => analyzeDocument(f));
  };

  const handleFileSelect = (e) => {
    Array.from(e.target.files).forEach(f => analyzeDocument(f));
  };

  const removeDocument = (docId) => {
    setDocuments(prev => prev.filter(d => d.id !== docId));
    const newFindings = { ...findings };
    delete newFindings[docId];
    setFindings(newFindings);
    if (selectedDoc === docId) setSelectedDoc(null);
  };

  const exportReport = () => {
    if (!selectedDoc || !findings[selectedDoc]) return;
    const doc = documents.find(d => d.id === selectedDoc);
    const analysis = findings[selectedDoc];

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>DD Report - ${doc.name}</title>
<style>
  body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 0 40px; color: #1a1a1a; }
  h1 { font-size: 24px; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin-top: 32px; }
  .meta { font-family: monospace; font-size: 12px; color: #666; margin-bottom: 24px; }
  .summary { font-size: 16px; line-height: 1.6; background: #f9f9f9; padding: 16px; border-left: 3px solid #1a1a1a; }
  .item { border-left: 3px solid #b3261e; padding: 8px 0 8px 16px; margin-bottom: 16px; }
  .item.amber { border-left-color: #92580a; }
  .item-title { font-weight: bold; font-size: 15px; }
  .badge { display: inline-block; font-size: 10px; padding: 2px 6px; background: #fbeae8; color: #b3261e; font-family: monospace; text-transform: uppercase; margin-left: 8px; }
  .cite { font-size: 12px; color: #888; font-style: italic; margin-top: 4px; }
  .impact-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #ddd; margin-top: 8px; }
  .impact-cell { background: white; padding: 12px; }
  .impact-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin-bottom: 4px; font-family: monospace; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
<h1>Due Diligence Analysis Report</h1>
<div class="meta">
  Document: ${doc.name}<br>
  Date: ${new Date().toLocaleDateString()}<br>
  Type: ${analysis.documentType}<br>
  Confidence: ${(analysis.confidence || '').toUpperCase()}
</div>
<h2>Executive Summary</h2>
<div class="summary">${analysis.executiveSummary}</div>
${analysis.risks?.length ? `<h2>Key Risks (${analysis.risks.length})</h2>${analysis.risks.map(r => `<div class="item"><div class="item-title">${r.title} <span class="badge">${r.severity}</span></div><div>${r.description}</div><div class="cite">Citation: ${r.citation}</div></div>`).join('')}` : ''}
${analysis.redFlags?.length ? `<h2>Red Flags (${analysis.redFlags.length})</h2>${analysis.redFlags.map(f => `<div class="item"><div class="item-title">${f.title}</div><div>${f.description}</div><div><strong>Implication:</strong> ${f.implication}</div><div class="cite">Location: ${f.citation}</div></div>`).join('')}` : ''}
${analysis.findings?.length ? `<h2>Critical Findings (${analysis.findings.length})</h2>${analysis.findings.map(f => `<div class="item amber"><div class="item-title">${f.title}</div><div><strong>Impact:</strong> ${f.impact}</div><div><strong>Action:</strong> ${f.recommendation}</div></div>`).join('')}` : ''}
<h2>Deal Impact Assessment</h2>
<div class="impact-grid">
  <div class="impact-cell"><div class="impact-label">Valuation</div>${analysis.dealImpact?.valuation}</div>
  <div class="impact-cell"><div class="impact-label">Timeline</div>${analysis.dealImpact?.timeline}</div>
  <div class="impact-cell"><div class="impact-label">Conditions</div>${analysis.dealImpact?.conditions}</div>
</div>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    setTimeout(() => { win?.print(); }, 500);
  };

  const currentAnalysis = selectedDoc ? findings[selectedDoc] : null;
  const filteredRisks = currentAnalysis?.risks?.filter(r => r.title.toLowerCase().includes(searchTerm.toLowerCase()) || r.description.toLowerCase().includes(searchTerm.toLowerCase())) || [];
  const filteredFlags = currentAnalysis?.redFlags?.filter(f => f.title.toLowerCase().includes(searchTerm.toLowerCase()) || f.description.toLowerCase().includes(searchTerm.toLowerCase())) || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-slate-900">M&A Due Diligence</h1>
          <p className="text-slate-600 mt-1">Document analysis & risk identification</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">DOCUMENTS</h2>
              <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} className="border-2 border-dashed border-slate-300 rounded-lg p-4 mb-4 cursor-pointer hover:border-slate-400" onClick={() => fileInputRef.current?.click()}>
                <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" accept=".pdf,.docx,.xlsx,.txt,.doc,.xls" />
                <FileText className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-600 text-center">Drop files or click</p>
                <p className="text-xs text-slate-500 text-center mt-1">PDF, Word, Excel, Text</p>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {documents.length === 0 ? <p className="text-xs text-slate-500 text-center py-4">No documents</p> : documents.map(doc => (
                  <div key={doc.id} onClick={() => setSelectedDoc(doc.id)} className={`p-3 rounded-lg cursor-pointer text-xs transition ${selectedDoc === doc.id ? 'bg-red-50 border border-red-300' : 'bg-slate-50 border border-slate-200'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{doc.name}</p>
                        <p className="text-slate-500 text-xs mt-1">{doc.uploadDate}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); removeDocument(doc.id); }} className="ml-2 text-slate-400 hover:text-red-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-9">
            {!selectedDoc ? (
              <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No document selected</h3>
                <p className="text-slate-600">Upload documents to begin analysis</p>
              </div>
            ) : loading ? (
              <div className="bg-white rounded-lg border border-slate-200 p-12 flex items-center justify-center">
                <Loader className="w-6 h-6 text-red-500 animate-spin mr-3" />
                <p className="text-slate-600">Analyzing document...</p>
              </div>
            ) : currentAnalysis ? (
              <div className="space-y-6">
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">{documents.find(d => d.id === selectedDoc)?.name}</h2>
                      <p className="text-sm text-slate-600 mt-1">Type: <span className="font-medium">{currentAnalysis.documentType}</span></p>
                    </div>
                    <button onClick={exportReport} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">
                      <Download className="w-4 h-4" /> Export PDF
                    </button>
                  </div>
                  <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Search findings..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm" />
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600" /> EXECUTIVE SUMMARY
                  </h3>
                  <p className="text-sm text-slate-700">{currentAnalysis.executiveSummary}</p>
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <span className="text-xs font-medium text-slate-500">Confidence: </span>
                    <span className={`text-xs font-semibold ${currentAnalysis.confidence === 'high' ? 'text-green-600' : currentAnalysis.confidence === 'medium' ? 'text-amber-600' : 'text-red-600'}`}>{currentAnalysis.confidence?.toUpperCase()}</span>
                  </div>
                </div>

                {filteredRisks.length > 0 && (
                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4">KEY RISKS</h3>
                    <div className="space-y-4">
                      {filteredRisks.map((risk, idx) => (
                        <div key={idx} className="border-l-4 border-red-600 pl-4 py-2">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-sm text-slate-900">{risk.title}</h4>
                            <span className={`text-xs font-bold px-2 py-1 rounded ${risk.severity === 'critical' ? 'bg-red-100 text-red-800' : risk.severity === 'high' ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'}`}>{risk.severity?.toUpperCase()}</span>
                          </div>
                          <p className="text-sm text-slate-700 mb-2">{risk.description}</p>
                          <p className="text-xs text-slate-500 italic">Citation: {risk.citation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {filteredFlags.length > 0 && (
                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4">RED FLAGS</h3>
                    <div className="space-y-4">
                      {filteredFlags.map((flag, idx) => (
                        <div key={idx} className="border-l-4 border-red-500 pl-4 py-2">
                          <h4 className="font-semibold text-sm text-slate-900 mb-2">{flag.title}</h4>
                          <p className="text-sm text-slate-700 mb-2">{flag.description}</p>
                          <p className="text-sm text-slate-700 mb-2"><span className="font-medium">Implication:</span> {flag.implication}</p>
                          <p className="text-xs text-slate-500 italic">Location: {flag.citation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentAnalysis.findings?.length > 0 && (
                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4">CRITICAL FINDINGS</h3>
                    <div className="space-y-4">
                      {currentAnalysis.findings.map((finding, idx) => (
                        <div key={idx} className="border-l-4 border-amber-500 pl-4 py-2">
                          <h4 className="font-semibold text-sm text-slate-900 mb-2">{finding.title}</h4>
                          <p className="text-sm text-slate-700 mb-2"><span className="font-medium">Impact:</span> {finding.impact}</p>
                          <p className="text-sm text-slate-700"><span className="font-medium">Action:</span> {finding.recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-4">DEAL IMPACT</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-600 font-medium mb-2">VALUATION</p>
                      <p className="text-sm text-slate-900">{currentAnalysis.dealImpact?.valuation}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-600 font-medium mb-2">TIMELINE</p>
                      <p className="text-sm text-slate-900">{currentAnalysis.dealImpact?.timeline}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-600 font-medium mb-2">CONDITIONS</p>
                      <p className="text-sm text-slate-900">{currentAnalysis.dealImpact?.conditions}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
