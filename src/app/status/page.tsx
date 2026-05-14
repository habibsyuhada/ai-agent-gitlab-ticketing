'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Download, FileText, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AutomationResult, ParsedTicket } from '@/types/ticket';

export default function StatusPage() {
  const [result, setResult] = useState<AutomationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const automationResult = sessionStorage.getItem('automationResult');

    if (automationResult) {
      try {
        setResult(JSON.parse(automationResult));
      } catch (err) {
        setError('FAILED TO LOAD AUTOMATION RESULT');
      }
    } else {
      setError('NO AUTOMATION RESULT FOUND. PLEASE START AUTOMATION FROM THE PREVIEW PAGE.');
    }

    setLoading(false);
  }, []);

  const getStatusIcon = (status: ParsedTicket['status']) => {
    switch (status) {
      case 'success':
      case 'dry_run_success':
        return <CheckCircle className="w-4 h-4 text-green-700" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-[var(--color-error)]" />;
      case 'processing':
        return <div className="spinner" style={{ width: 14, height: 14 }}></div>;
      default:
        return <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />;
    }
  };

  const getStatusLabel = (status: ParsedTicket['status']) => {
    switch (status) {
      case 'success':
        return 'SUCCESS';
      case 'dry_run_success':
        return 'DRY_RUN_OK';
      case 'failed':
        return 'FAILED';
      case 'processing':
        return 'PROCESSING';
      default:
        return 'PENDING';
    }
  };

  const downloadResultsAsJson = () => {
    if (!result) return;

    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `automation-results-${result.runId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-paper)] flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" style={{ width: 32, height: 32, borderWidth: 3 }}></div>
          <p className="text-xs font-display">LOADING RESULTS...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--color-paper)] flex items-center justify-center">
        <div className="panel max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-[var(--color-error)]" />
            <h2 className="text-lg font-display">ERROR</h2>
          </div>
          <p className="text-sm mb-6">{error}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="btn btn-secondary w-full"
          >
            RETURN TO UPLOAD
          </button>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  const successRows = result.rows.filter(r => r.status === 'success' || r.status === 'dry_run_success');
  const failedRows = result.rows.filter(r => r.status === 'failed');
  const durationSeconds = (result.duration / 1000).toFixed(1);
  const hasSolveData = result.solveSuccessCount !== undefined;

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      {/* Header */}
      <header className="border-b-2 border-[var(--color-border)] bg-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => window.location.href = '/'}
            className="flex items-center gap-2 text-xs hover:text-[var(--color-amber)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            BACK TO UPLOAD
          </button>
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4" />
            <span className="text-xs font-display">AUTOMATION RESULTS</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="panel text-center">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Total</p>
            <p className="text-2xl font-display mt-1">{result.totalRows}</p>
          </div>
          <div className="panel text-center border-green-800">
            <p className="text-[10px] text-green-700 uppercase">Success</p>
            <p className="text-2xl font-display mt-1 text-green-800">{result.successCount}</p>
          </div>
          <div className="panel text-center">
            <p className="text-[10px] text-[var(--color-error)] uppercase">Failed</p>
            <p className="text-2xl font-display mt-1 text-[var(--color-error)]">{result.failedCount}</p>
          </div>
          <div className="panel text-center">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Skipped</p>
            <p className="text-2xl font-display mt-1">{result.skippedCount}</p>
          </div>
          <div className="panel text-center">
            <p className="text-[10px] text-[var(--color-amber)] uppercase">Duration</p>
            <p className="text-lg font-display mt-1">{durationSeconds}s</p>
          </div>
        </div>

        {/* Solve Stats */}
        {hasSolveData && (
          <div className="panel mb-6 border-blue-800">
            <div className="tech-header">
              <span className="text-xs font-display">SOLVE RESULTS</span>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center">
                <p className="text-[10px] text-green-700 uppercase">Solved</p>
                <p className="text-2xl font-display mt-1 text-green-800">{result.solveSuccessCount || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-[var(--color-error)] uppercase">Failed</p>
                <p className="text-2xl font-display mt-1 text-[var(--color-error)]">{result.solveFailedCount || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Not Found</p>
                <p className="text-2xl font-display mt-1">{result.solveNotFoundCount || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Run Info */}
        <div className="panel mb-6">
          <div className="tech-header">
            <span className="text-xs font-display">RUN INFORMATION</span>
          </div>
          <div className="grid md:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-[var(--color-text-muted)]">RUN_ID:</span>
              <span className="ml-2 font-mono">{result.runId}</span>
            </div>
            <div>
              <span className="text-[var(--color-text-muted)]">START:</span>
              <span className="ml-2 font-mono">{new Date(result.startTime).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-[var(--color-text-muted)]">END:</span>
              <span className="ml-2 font-mono">{new Date(result.endTime).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Failed Rows Alert */}
        {failedRows.length > 0 && (
          <div className="notice notice-error mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-[var(--color-error)] flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-display mb-1">
                  {failedRows.length} ROWS FAILED TO PROCESS
                </p>
                <p className="text-[var(--color-text-muted)]">
                  SCREENSHOTS SAVED TO: automation-logs/screenshots/{result.runId}/
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Results Table */}
        <div className="panel overflow-hidden p-0 mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[var(--color-black)] text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-display">#</th>
                  <th className="px-3 py-2 text-left font-display">STATUS</th>
                  <th className="px-3 py-2 text-left font-display">REQUESTOR</th>
                  <th className="px-3 py-2 text-left font-display">TYPE</th>
                  <th className="px-3 py-2 text-left font-display">CATEGORY</th>
                  <th className="px-3 py-2 text-left font-display">DEPARTMENT</th>
                  <th className="px-3 py-2 text-left font-display">DESCRIPTION</th>
                  <th className="px-3 py-2 text-left font-display">ERROR</th>
                  <th className="px-3 py-2 text-left font-display">SCREENSHOT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {result.rows.map((row, index) => (
                  <tr
                    key={index}
                    className={cn(
                      "hover:bg-[var(--color-paper-dark)]",
                      row.status === 'failed' && "bg-red-50/50",
                      (row.status === 'success' || row.status === 'dry_run_success') && "bg-green-50/30"
                    )}
                  >
                    <td className="px-3 py-2 font-mono">{row._rowIndex || index + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(row.status)}
                        <span className="font-mono text-[10px]">{getStatusLabel(row.status)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono">{row.Requestor}</td>
                    <td className="px-3 py-2 font-mono truncate max-w-[80px]">{row.type}</td>
                    <td className="px-3 py-2 font-mono truncate max-w-[80px]">{row.Category}</td>
                    <td className="px-3 py-2 font-mono truncate max-w-[80px]">{row.Department}</td>
                    <td className="px-3 py-2 font-mono truncate max-w-[150px]" title={row.Description}>
                      {row.Description}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-error)] font-mono text-[10px] max-w-[200px] truncate" title={row.error}>
                      {row.error || '-'}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px]">
                      {row.screenshotPath ? (
                        <span className="text-green-700">SAVED</span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Bar */}
        <div className="panel bg-[var(--color-black)] text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs">
              <p className="text-[var(--color-text-muted)]">AUTOMATION COMPLETE</p>
              <p className="font-display">
                {result.successCount} OF {result.totalRows} ROWS PROCESSED SUCCESSFULLY
                {hasSolveData && ` // ${result.solveSuccessCount || 0} SOLVED`}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={downloadResultsAsJson}
                className="btn"
              >
                <Download className="w-3 h-3" />
                DOWNLOAD JSON
              </button>
              <button
                onClick={() => {
                  sessionStorage.clear();
                  window.location.href = '/';
                }}
                className="btn btn-primary"
              >
                NEW AUTOMATION
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t border-[var(--color-border)] text-center">
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase">
            Internal RPA Tool // Results logged to automation-logs/runs/{result.runId}.json
          </p>
        </footer>
      </main>
    </div>
  );
}
