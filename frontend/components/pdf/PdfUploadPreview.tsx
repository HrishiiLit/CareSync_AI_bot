"use client";

import React, { useEffect, useState } from 'react';
import { uploadPdf, extractPdfAndExecute, listWorkflows } from '@/services/api';
import { useLocalAuth } from '@/lib/local-auth';
import { Button } from '@/components/ui/button';

export default function PdfUploadPreview({ patientId }: { patientId?: string | null }) {
  const { user } = useLocalAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const doctorId = user?.doctor_id ?? user?.sub;
        if (!doctorId) return;
        const wf = await listWorkflows(doctorId, 'ENABLED');
        setWorkflows(Array.isArray(wf) ? wf : []);
        if (Array.isArray(wf) && wf.length > 0) setSelectedWorkflow(wf[0].id);
      } catch (e) {
        // ignore
      }
    };
    load();
  }, [user]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResult(null);
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  };

  const doUpload = async () => {
    if (!file) return setError('Pick a PDF first');
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await uploadPdf(file, patientId ?? undefined, user?.doctor_id ?? undefined);
      setResult({ type: 'upload', data: resp });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setUploading(false);
    }
  };

  const doExtractAndExecute = async () => {
    if (!file) return setError('Pick a PDF first');
    if (!selectedWorkflow) return setError('Choose a workflow');
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await extractPdfAndExecute(file, patientId ?? '', selectedWorkflow);
      setResult({ type: 'execute', data: resp });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-4">
      <div className="mb-3">
        <input type="file" accept="application/pdf" onChange={onFile} />
      </div>

      <div className="flex gap-2 items-center mb-4">
        <Button onClick={doUpload} disabled={!file || uploading}>{uploading ? 'Working…' : 'Upload & Preview'}</Button>
        <select value={selectedWorkflow ?? ''} onChange={(e) => setSelectedWorkflow(e.target.value)} className="px-2 py-1 rounded border">
          <option value="">Select workflow</option>
          {workflows.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <Button variant="secondary" onClick={doExtractAndExecute} disabled={!file || !selectedWorkflow || uploading}>{uploading ? 'Working…' : 'Extract & Execute'}</Button>
      </div>

      {error && <div className="text-destructive">{error}</div>}

      {result && result.type === 'upload' && (
        <div className="space-y-3">
          <h4 className="font-medium">Parsed Result</h4>
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(result.data.parsed, null, 2)}</pre>
        </div>
      )}

      {result && result.type === 'execute' && (
        <div className="space-y-3">
          <h4 className="font-medium">Execution Result</h4>
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(result.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
