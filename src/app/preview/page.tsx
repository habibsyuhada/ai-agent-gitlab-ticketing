'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Play, CheckCircle, XCircle, AlertTriangle, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ParsedTicket, AutomationOptions } from '@/types/ticket';

export default function PreviewPage() {
  const [rows, setRows] = useState<ParsedTicket[]>([]);
  const [options, setOptions] = useState<AutomationOptions>({
    dryRun: true,
    headless: false,
    delayMs: 3000,
    startRow: undefined,
    endRow: undefined,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const parsedData = sessionStorage.getItem('parsedData');
    const automationOptions = sessionStorage.getItem('automationOptions');

    if (parsedData) {
      try {
        const data = JSON.parse(parsedData);
        setRows(data.rows || []);
      } catch (err) {
        setError('FAILED TO LOAD PARSED DATA');
      }
    } else {
      setError('NO DATA FOUND. PLEASE UPLOAD A FILE FIRST.');
    }

    if (automationOptions) {
      try {
        setOptions(JSON.parse(automationOptions));
      } catch (err) {
        console.error('Failed to parse automation options');
      }
    }

    setLoading(false);
  }, []);

  const validRows = rows.filter(r => r.validationResult.isValid);
  const invalidRows = rows.filter(r => !r.validationResult.isValid);

  const handleStartAutomation = async (validOnly: boolean = true) => {
    setStarting(true);
    setError(null);

    try {
      const rowsToProcess = validOnly ? validRows : rows;

      if (rowsToProcess.length === 0) {
        throw new Error('NO VALID ROWS TO PROCESS');
      }

      const response = await fetch('/api/automation/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rows: rowsToProcess,
          options,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || 'AUTOMATION FAILED');
      }

      sessionStorage.setItem('automationResult', JSON.stringify(result.data));
      window.location.href = '/status';

    } catch (err) {
      setError(err instanceof Error ? err.message : 'FAILED TO START AUTOMATION');
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-paper)] flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" style={{ width: 32, height: 32, borderWidth: 3 }}></div>
          <p className="text-xs font-display">LOADING PREVIEW...</p>
        </div>
      </div>
    );
  }

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
            <Database className="w-4 h-4" />
            <span className="text-xs font-display">DATA PREVIEW</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="panel text-center">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Total Rows</p>
            <p className="text-2xl font-display mt-1">{rows.length}</p>
          </div>
          <div className="panel text-center border-green-800">
            <p className="text-[10px] text-green-700 uppercase">Valid Rows</p>
            <p className="text-2xl font-display mt-1 text-green-800">{validRows.length}</p>
          </div>
          <div className="panel text-center">
            <p className="text-[10px] text-[var(--color-error)] uppercase">Invalid Rows</p>
            <p className="text-2xl font-display mt-1 text-[var(--color-error)]">{invalidRows.length}</p>
          </div>
          <div className="panel text-center">
            <p className="text-[10px] text-[var(--color-amber)] uppercase">Mode</p>
            <p className="text-lg font-display mt-1">
              {options.dryRun ? 'DRY RUN' : 'LIVE'}
            </p>
          </div>
        </div>

        {/* Config Display */}
        <div className="panel mb-6">
          <div className="tech-header">
            <span className="text-xs font-display">CONFIGURATION</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[var(--color-text-muted)]">DRY_RUN:</span>
              <span className="ml-2 font-mono">{options.dryRun ? 'TRUE' : 'FALSE'}</span>
            </div>
            <div>
              <span className="text-[var(--color-text-muted)]">HEADLESS:</span>
              <span className="ml-2 font-mono">{options.headless ? 'TRUE' : 'FALSE'}</span>
            </div>
            <div>
              <span className="text-[var(--color-text-muted)]">DELAY:</span>
              <span className="ml-2 font-mono">{options.delayMs}MS</span>
            </div>
            <div>
              <span className="text-[var(--color-text-muted)]">RANGE:</span>
              <span className="ml-2 font-mono">{options.startRow || 'ALL'}-{options.endRow || 'ALL'}</span>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="notice notice-error mb-6">
            <p className="text-xs font-display">ERROR: {error}</p>
          </div>
        )}

        {/* Warning for Invalid Rows */}
        {invalidRows.length > 0 && (
          <div className="notice mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-[var(--color-amber)] flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-display mb-1">
                  WARNING: {invalidRows.length} ROWS HAVE VALIDATION ERRORS
                </p>
                <p className="text-[var(--color-text-muted)]">
                  THESE ROWS WILL BE SKIPPED IF YOU PROCESS VALID ROWS ONLY.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="panel mb-6 bg-[var(--color-black)] text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs">
              <p className="text-[var(--color-text-muted)]">READY TO AUTOMATE</p>
              <p className="font-display">
                {validRows.length} VALID ROWS DETECTED
              </p>
            </div>
            <div className="flex gap-3">
              {invalidRows.length > 0 ? (
                <>
                  <button
                    onClick={() => handleStartAutomation(true)}
                    disabled={starting || validRows.length === 0}
                    className={cn(
                      "btn",
                      (starting || validRows.length === 0) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {starting ? (
                      <>
                        <div className="spinner"></div>
                        STARTING...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        VALID ONLY ({validRows.length})
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleStartAutomation(false)}
                    disabled={starting}
                    className={cn(
                      "btn btn-secondary",
                      starting && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {starting ? (
                      <>
                        <div className="spinner"></div>
                        STARTING...
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3" />
                        ALL ROWS ({rows.length})
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleStartAutomation(true)}
                  disabled={starting}
                  className={cn(
                    "btn btn-primary",
                    starting && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {starting ? (
                    <>
                      <div className="spinner"></div>
                      STARTING...
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      START AUTOMATION ({rows.length})
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="panel overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[var(--color-black)] text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-display">#</th>
                  <th className="px-3 py-2 text-left font-display">STATUS</th>
                  <th className="px-3 py-2 text-left font-display">TYPE</th>
                  <th className="px-3 py-2 text-left font-display">CATEGORY</th>
                  <th className="px-3 py-2 text-left font-display">REQUESTOR</th>
                  <th className="px-3 py-2 text-left font-display">COMPUTER</th>
                  <th className="px-3 py-2 text-left font-display">DEPT</th>
                  <th className="px-3 py-2 text-left font-display">LOCATION</th>
                  <th className="px-3 py-2 text-left font-display">PROJECT</th>
                  <th className="px-3 py-2 text-left font-display">DESCRIPTION</th>
                  <th className="px-3 py-2 text-left font-display">PRIORITY</th>
                  <th className="px-3 py-2 text-left font-display">ASSIGN</th>
                  <th className="px-3 py-2 text-left font-display">ERRORS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {rows.map((row, index) => (
                  <tr
                    key={index}
                    className={cn(
                      "hover:bg-[var(--color-paper-dark)]",
                      !row.validationResult.isValid && "bg-red-50/50"
                    )}
                  >
                    <td className="px-3 py-2 font-mono">{row._rowIndex || index + 1}</td>
                    <td className="px-3 py-2">
                      {row.validationResult.isValid ? (
                        <CheckCircle className="w-4 h-4 text-green-700" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[var(--color-error)]" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono truncate max-w-[80px]">{row.type || '-'}</td>
                    <td className="px-3 py-2 font-mono truncate max-w-[80px]">{row.Category || '-'}</td>
                    <td className="px-3 py-2 font-mono truncate max-w-[100px]">{row.Requestor || '-'}</td>
                    <td className="px-3 py-2 font-mono truncate max-w-[80px]">{row.ComputerName || '-'}</td>
                    <td className="px-3 py-2 font-mono truncate max-w-[60px]">{row.Department || '-'}</td>
                    <td className="px-3 py-2 font-mono truncate max-w-[60px]">{row.Location || '-'}</td>
                    <td className="px-3 py-2 font-mono truncate max-w-[60px]">{row.Project || '-'}</td>
                    <td className="px-3 py-2 font-mono truncate max-w-[150px]" title={row.Description}>
                      {row.Description || '-'}
                    </td>
                    <td className="px-3 py-2 font-mono truncate max-w-[60px]">{row.Priority || '-'}</td>
                    <td className="px-3 py-2 font-mono truncate max-w-[80px]">{row.Assign || '-'}</td>
                    <td className="px-3 py-2 text-[var(--color-error)] font-mono text-[10px]">
                      {row.validationResult.missingFields.join(', ') || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
