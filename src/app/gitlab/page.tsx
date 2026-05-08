'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Users, Calendar, Play, AlertTriangle, Cpu, Settings } from 'lucide-react';
import Select, { MultiValue } from 'react-select';
import { cn } from '@/lib/utils';
import { GitLabUser } from '@/types/gitlab';
import { getYesterdayDate } from '@/lib/gitlab';

interface SelectOption {
  value: number;
  label: string;
}

export default function GitLabImportPage() {
  const [users, setUsers] = useState<GitLabUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<SelectOption[]>([]);
  const [fromDate, setFromDate] = useState(getYesterdayDate());
  const [toDate, setToDate] = useState(getYesterdayDate());
  const [options, setOptions] = useState({
    dryRun: true,
    headless: false,
    delayMs: 3000,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/gitlab/users');
        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }
        const data = await response.json();
        setUsers(data);

        const defaultUsers = ['Habib Syuhada', 'Mohammad Fahmi Aziz', 'iqbal'];
        const selectedDefaults = data
          .filter((u: GitLabUser) => defaultUsers.includes(u.name))
          .map((u: GitLabUser) => ({ value: u.id, label: u.name }));

        if (selectedDefaults.length > 0) {
          setSelectedUsers(selectedDefaults);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const userOptions: SelectOption[] = users
    .filter((u) => u.state === 'active')
    .map((u) => ({
      value: u.id,
      label: `${u.name} (@${u.username})`,
    }));

  const handleUserChange = (newValue: MultiValue<SelectOption>) => {
    setSelectedUsers(newValue as SelectOption[]);
  };

  const handleSubmit = async () => {
    if (selectedUsers.length === 0) {
      setError('Please select at least one user');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/gitlab/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromDate,
          toDate,
          userIds: selectedUsers.map((u) => u.value),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Parse failed');
      }

      sessionStorage.setItem('parsedData', JSON.stringify(result.data));
      sessionStorage.setItem('automationOptions', JSON.stringify(options));
      window.location.href = '/preview';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process data');
    } finally {
      setSubmitting(false);
    }
  };

  const customStyles = {
    control: (provided: any) => ({
      ...provided,
      backgroundColor: 'var(--color-paper)',
      borderColor: 'var(--color-border)',
      minHeight: '38px',
      fontSize: '12px',
      fontFamily: 'monospace',
    }),
    menu: (provided: any) => ({
      ...provided,
      backgroundColor: 'var(--color-paper)',
      borderColor: 'var(--color-border)',
    }),
    option: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: state.isSelected ? 'var(--color-black)' : 'var(--color-paper)',
      color: state.isSelected ? 'white' : 'var(--color-text)',
      fontSize: '12px',
      fontFamily: 'monospace',
    }),
    multiValue: (provided: any) => ({
      ...provided,
      backgroundColor: 'var(--color-black)',
      color: 'white',
    }),
    multiValueLabel: (provided: any) => ({
      ...provided,
      color: 'white',
      fontSize: '11px',
      fontFamily: 'monospace',
    }),
    multiValueRemove: (provided: any) => ({
      ...provided,
      color: 'white',
      ':hover': {
        backgroundColor: 'var(--color-error)',
        color: 'white',
      },
    }),
  };

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <header className="border-b-2 border-[var(--color-border)] bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => (window.location.href = '/')}
            className="flex items-center gap-2 text-xs hover:text-[var(--color-amber)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            BACK TO HOME
          </button>
          <div className="flex items-center gap-3">
            <Cpu className="w-4 h-4" />
            <span className="text-xs font-display">GITLAB IMPORT</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="notice mb-6 tech-corner">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-[var(--color-amber)] flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-display mb-1">GITLAB COMMIT TO TICKET</p>
              <p className="text-[var(--color-text-muted)]">
                FETCH COMMITS FROM GITLAB AND AUTO-GENERATE HELPDESK TICKETS. MERGE
                COMMITS WILL BE SKIPPED.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="notice notice-error mb-6">
            <p className="text-xs font-display">ERROR: {error}</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="panel">
            <div className="tech-header">
              <Calendar className="w-4 h-4" />
              <h2 className="text-sm">DATE RANGE</h2>
            </div>

            <div className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-display block mb-2">FROM DATE</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="input-tech w-full"
                />
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  API WILL QUERY FROM {fromDate} - 1 DAY
                </p>
              </div>

              <div>
                <label className="text-xs font-display block mb-2">TO DATE</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="input-tech w-full"
                />
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  API WILL QUERY UNTIL {toDate} + 1 DAY
                </p>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="tech-header">
              <Users className="w-4 h-4" />
              <h2 className="text-sm">SELECT USERS</h2>
            </div>

            <div className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="spinner"></div>
                  <span className="text-xs font-display ml-3">LOADING USERS...</span>
                </div>
              ) : (
                <>
                  <Select
                    isMulti
                    value={selectedUsers}
                    onChange={handleUserChange}
                    options={userOptions}
                    styles={customStyles}
                    placeholder="SELECT USERS..."
                    noOptionsMessage={() => 'NO USERS FOUND'}
                    isLoading={loading}
                  />
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-2">
                    {selectedUsers.length} USER{selectedUsers.length !== 1 ? 'S' : ''} SELECTED
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="panel mt-6">
          <div className="tech-header">
            <Settings className="w-4 h-4" />
            <h2 className="text-sm">AUTOMATION CONFIG</h2>
          </div>

          <div className="space-y-5 mt-4">
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
          </div>
        </div>

        <div className="panel mt-6 bg-[var(--color-black)] text-white">
          <div className="flex items-center justify-between">
            <div className="text-xs">
              <p className="text-[var(--color-text-muted)]">
                READY TO IMPORT // {options.dryRun ? 'DRY RUN' : 'LIVE'}
              </p>
              <p className="font-display">
                {selectedUsers.length > 0
                  ? `${selectedUsers.length} USER${selectedUsers.length !== 1 ? 'S' : ''} SELECTED`
                  : 'NO USERS SELECTED'}
              </p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={selectedUsers.length === 0 || submitting}
              className={cn(
                'btn btn-primary',
                (selectedUsers.length === 0 || submitting) &&
                  'opacity-50 cursor-not-allowed'
              )}
            >
              {submitting ? (
                <>
                  <div className="spinner"></div>
                  PROCESSING...
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  IMPORT AND PREVIEW
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
