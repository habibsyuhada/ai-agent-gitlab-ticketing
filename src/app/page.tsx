'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Upload, FileSpreadsheet, Settings, Info, Play, Download, Cpu, AlertTriangle, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';

const helpdeskUrl = process.env.NEXT_PUBLIC_HELPDESK_URL || '';

function getHelpdeskLabel(url: string): string {
  if (!url) {
    return 'HELPDESK PORTAL';
  }

  try {
    return new URL(url).hostname.toUpperCase();
  } catch {
    return 'HELPDESK PORTAL';
  }
}

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [options, setOptions] = useState({
    dryRun: true,
    headless: false,
    delayMs: 3000,
    startRow: '',
    endRow: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls')) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError('INVALID FILE FORMAT. USE .XLSX OR .XLS');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUploadAndPreview = async () => {
    if (!file) {
      setError('NO FILE SELECTED');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/excel/parse', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || 'PARSE FAILED');
      }

      sessionStorage.setItem('parsedData', JSON.stringify(result.data));
      sessionStorage.setItem('automationOptions', JSON.stringify(options));
      window.location.href = '/preview';

    } catch (err) {
      setError(err instanceof Error ? err.message : 'PARSE FAILED');
    } finally {
      setLoading(false);
    }
  };

  const downloadSampleTemplate = async () => {
    try {
      const response = await fetch('/api/sample');
      if (!response.ok) throw new Error('DOWNLOAD FAILED');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'helpdesk_tickets_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download template:', error);
      setError('TEMPLATE DOWNLOAD FAILED');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      {/* Top Bar - Technical Header */}
      <header className="border-b-2 border-[var(--color-border)] bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--color-border)] flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-display">Helpdesk RPA Automation</h1>
              <p className="text-xs text-[var(--color-text-muted)]">v1.0.0 // INTERNAL TOOL</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <Link
              href="/gitlab"
              className="flex items-center gap-2 hover:text-[var(--color-amber)] transition-colors"
            >
              <GitBranch className="w-3 h-3" />
              GITLAB IMPORT
            </Link>
            <span className="flex items-center gap-2">
              <span className="status-dot active"></span>
              SYSTEM READY
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Info Notice */}
        <div className="notice mb-6 tech-corner">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-[var(--color-amber)] flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-display mb-1">REQUIRED COLUMNS (CASE-INSENSITIVE):</p>
              <p className="mb-2 font-mono text-[var(--color-text-muted)]">
                TYPE | CATEGORY | REQUESTOR | COMPUTER NAME | DEPARTMENT | LOCATION | PROJECT | DESCRIPTION | PRIORITY | ASSIGN
              </p>
              <p className="text-[var(--color-text-muted)]">
                ENSURE YOU ARE LOGGED INTO{' '}
                <a
                  href={helpdeskUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-amber)] underline underline-offset-2"
                >
                  {getHelpdeskLabel(helpdeskUrl)}
                </a>
                {' '}BEFORE INITIATING AUTOMATION.
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Upload Panel */}
          <div className="panel">
            <div className="tech-header">
              <FileSpreadsheet className="w-4 h-4" />
              <h2 className="text-sm">DATA INPUT</h2>
            </div>

            <div
              className={cn(
                "dropzone p-8 text-center cursor-pointer transition-all",
                dragActive && "drag-active"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer block">
                <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-[var(--color-text-muted)]" />
                <p className="text-xs font-display mb-1">DRAG EXCEL FILE HERE</p>
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase">
                  Or click to browse
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-2">
                  .XLSX / .XLS ONLY
                </p>
              </label>
            </div>

            {file && (
              <div className="mt-4 file-item">
                <FileSpreadsheet className="w-4 h-4 text-[var(--color-success)]" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{file.name}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <button
                  onClick={() => { setFile(null); setError(null); }}
                  className="text-xs text-[var(--color-error)] hover:underline px-2"
                >
                  CLEAR
                </button>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
              <button
                onClick={downloadSampleTemplate}
                className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                <Download className="w-3 h-3" />
                DOWNLOAD SAMPLE TEMPLATE
              </button>
            </div>
          </div>

          {/* Options Panel */}
          <div className="panel">
            <div className="tech-header">
              <Settings className="w-4 h-4" />
              <h2 className="text-sm">AUTOMATION CONFIG</h2>
            </div>

            <div className="space-y-5">
              {/* Dry Run Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-display block">DRY RUN MODE</label>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                    Test without submitting
                  </p>
                </div>
                <button
                  onClick={() => setOptions({ ...options, dryRun: !options.dryRun })}
                  className={cn(
                    "toggle-switch",
                    options.dryRun && "active"
                  )}
                />
              </div>

              {/* Headless Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-display block">HEADLESS MODE</label>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                    Run browser in background
                  </p>
                </div>
                <button
                  onClick={() => setOptions({ ...options, headless: !options.headless })}
                  className={cn(
                    "toggle-switch",
                    options.headless && "active"
                  )}
                />
              </div>

              {/* Delay Input */}
              <div>
                <label className="text-xs font-display block mb-2">
                  DELAY BETWEEN TICKETS
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={options.delayMs}
                    onChange={(e) => setOptions({ ...options, delayMs: parseInt(e.target.value) || 3000 })}
                    className="input-tech flex-1"
                    min="1000"
                    max="30000"
                  />
                  <span className="text-xs text-[var(--color-text-muted)] self-center">MS</span>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  RECOMMENDED: 3000MS
                </p>
              </div>

              {/* Row Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-display block mb-2">START ROW</label>
                  <input
                    type="number"
                    value={options.startRow}
                    onChange={(e) => setOptions({ ...options, startRow: e.target.value })}
                    placeholder="ALL"
                    className="input-tech"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-xs font-display block mb-2">END ROW</label>
                  <input
                    type="number"
                    value={options.endRow}
                    onChange={(e) => setOptions({ ...options, endRow: e.target.value })}
                    placeholder="ALL"
                    className="input-tech"
                    min="0"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="notice notice-error mt-6">
            <p className="text-xs font-display">ERROR: {error}</p>
          </div>
        )}

        {/* Action Bar */}
        <div className="mt-8 panel bg-[var(--color-black)] text-white">
          <div className="flex items-center justify-between">
            <div className="text-xs">
              <p className="text-[var(--color-text-muted)]">STATUS</p>
              <p className="font-display">
                {file ? 'READY TO PROCESS' : 'WAITING FOR INPUT'}
              </p>
            </div>
            <button
              onClick={handleUploadAndPreview}
              disabled={!file || loading}
              className={cn(
                "btn btn-primary",
                (!file || loading) && "opacity-50 cursor-not-allowed"
              )}
            >
              {loading ? (
                <>
                  <div className="spinner"></div>
                  PROCESSING...
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  UPLOAD AND PREVIEW
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t border-[var(--color-border)] text-center">
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase">
            Internal RPA Tool // For Valid Work Reporting Only
          </p>
        </footer>
      </main>
    </div>
  );
}
