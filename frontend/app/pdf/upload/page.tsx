"use client";

import React, { useEffect, useRef, useState } from 'react';
import { uploadPdf, listPatients } from '@/services/api';
import { useLocalAuth } from '@/lib/local-auth';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Sparkles, Loader2 } from 'lucide-react';

export default function PdfUploadPage() {
  const { user } = useLocalAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const doctorId = user?.doctor_id ?? user?.sub;
        if (!doctorId) return;
        const p = await listPatients(doctorId);
        setPatients(Array.isArray(p) ? p : []);
        if (Array.isArray(p) && p.length > 0) setSelectedPatient(p[0].id);
      } catch (e) {
        // ignore
      }
    };
    load();
  }, [user]);

  const handleFile = (ev: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResult(null);
    const f = ev.target.files?.[0] ?? null;
    setFile(f);
  };

  const doUpload = async () => {
    if (!file) return setError('Choose a PDF file first');
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const uploaded = await uploadPdf(file, selectedPatient ?? undefined, user?.doctor_id ?? undefined);
      // Response shape: { document: {...}, parsed: {...} }
      setResult(uploaded);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5" />
              PDF intake
            </div>
            <h1 className="mt-3 text-2xl font-semibold">Upload a PDF and preview what was extracted</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Drop in a lab report, referral, or clinical note to preview the parsed patient data before you save or execute anything.
            </p>
          </div>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="size-4" />
            Choose PDF
          </Button>
        </div>

        <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} />

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr,0.6fr]">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-8 text-center transition-colors hover:bg-muted/50"
          >
            <FileText className="size-8 text-primary" />
            <span className="mt-3 text-sm font-medium">Drop a PDF here or click to browse</span>
            <span className="mt-1 text-xs text-muted-foreground">Only PDF files are supported</span>
          </button>

          <div className="rounded-2xl border border-border bg-background p-4">
            <label className="block text-sm font-medium">Patient (optional)</label>
            <select
              value={selectedPatient ?? ''}
              onChange={(e) => setSelectedPatient(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">— none —</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.phone ?? ''}</option>
              ))}
            </select>

            <div className="mt-4 flex flex-col gap-3">
              <Button onClick={doUpload} disabled={uploading || !file} className="w-full">
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {uploading ? 'Uploading…' : 'Upload & Preview'}
              </Button>
              <p className="text-xs text-muted-foreground">
                {file ? `Selected: ${file.name}` : 'No file selected yet.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      )}

      {result && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-medium">Parsed Patient Info</h3>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(result.parsed.patient_info, null, 2)}</pre>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-medium">Lab Results</h3>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(result.parsed.lab_results, null, 2)}</pre>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-medium">Medications</h3>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(result.parsed.medications, null, 2)}</pre>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-medium">Extracted Tables</h3>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(result.parsed.tables, null, 2)}</pre>
          </div>

          <div className="rounded-xl border bg-card p-4 lg:col-span-2">
            <h3 className="font-medium">Raw Text (excerpt)</h3>
            <pre className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap text-xs">{(result.parsed.raw_text || '').slice(0, 800)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
