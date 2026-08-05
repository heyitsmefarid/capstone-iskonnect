import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  collection, doc, getDocs, writeBatch, setDoc, onSnapshot, query, orderBy, limit,
} from 'firebase/firestore';
import Swal from 'sweetalert2';
import {
  Database,
  DownloadCloud,
  UploadCloud,
  FileJson,
  AlertTriangle,
  CheckCircle,
  X,
  Clock,
  History,
} from 'lucide-react';
import Header from '../components/layout/Header';
import { initializeFirebase } from '../services/firebase';
import { logAudit } from '../services/auditLog';
import { getUsername } from '../utils/auth';
import {
  BACKUP_COLLECTIONS,
  buildBackupPayload,
  validateBackupFile,
  chunkArray,
} from '../utils/backupRestore';

// How many scheduled_backups documents the automatic-backup cron job keeps
// (see backend/functions/scheduled-backup.js's RETAIN_RUNS) — the list below
// can never show more than this many regardless of the limit() it queries.
const SCHEDULED_BACKUPS_RETAINED = 12;

const FREQUENCY_LABELS = { off: 'Off', weekly: 'Weekly', monthly: 'Monthly' };

export default function BackupRestore() {
  const { onMenuClick } = useOutletContext() || {};
  const fileInputRef = useRef(null);

  const [backingUp, setBackingUp] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);

  const [fileName, setFileName] = useState(null);
  const [parsedBackup, setParsedBackup] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selectedCollections, setSelectedCollections] = useState({});
  const [restoring, setRestoring] = useState(false);

  /* ── Automatic backups ── */
  const [schedule, setSchedule] = useState(null); // live doc: { frequency, lastRunAt, lastRunTotalDocuments, lastRunDocId }
  const [frequencyChoice, setFrequencyChoice] = useState('off'); // the radio group's pending selection
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [pastRuns, setPastRuns] = useState([]);
  const [downloadingRunId, setDownloadingRunId] = useState(null);

  useEffect(() => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return undefined;

    const unsubSchedule = onSnapshot(doc(db, 'system_config', 'backupSchedule'), (snap) => {
      const data = snap.exists() ? snap.data() : null;
      setSchedule(data);
      setFrequencyChoice(data?.frequency || 'off');
    });

    const unsubRuns = onSnapshot(
      query(collection(db, 'scheduled_backups'), orderBy('createdAt', 'desc'), limit(SCHEDULED_BACKUPS_RETAINED)),
      (snap) => setPastRuns(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setPastRuns([]) // collection may not exist yet — nothing has run
    );

    return () => {
      unsubSchedule();
      unsubRuns();
    };
  }, []);

  const handleSaveSchedule = async () => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) {
      Swal.fire({ icon: 'error', title: 'Not connected', text: 'Firestore is not configured in this environment.' });
      return;
    }
    setSavingSchedule(true);
    try {
      await setDoc(
        doc(db, 'system_config', 'backupSchedule'),
        { frequency: frequencyChoice, updatedAt: new Date().toISOString(), updatedBy: getUsername() },
        { merge: true }
      );
      logAudit({
        action: 'UPDATE',
        collection: 'system_config',
        documentId: 'backupSchedule',
        details: `Automatic backup schedule set to "${frequencyChoice}".`,
      });
      Swal.fire({
        icon: 'success',
        title: 'Schedule saved',
        text: frequencyChoice === 'off'
          ? 'Automatic backups are now off.'
          : `Automatic backups will run ${frequencyChoice}.`,
        timer: 2200,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Could not save schedule', text: err?.message || 'Something went wrong.' });
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDownloadPastRun = (run) => {
    setDownloadingRunId(run.id);
    try {
      const blob = new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `iskonnect-backup-${run.id}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingRunId(null);
    }
  };

  /* ── Backup ── */
  const handleBackup = async () => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) {
      Swal.fire({ icon: 'error', title: 'Not connected', text: 'Firestore is not configured in this environment.' });
      return;
    }

    setBackingUp(true);
    try {
      const collectionsData = {};
      for (const name of BACKUP_COLLECTIONS) {
        const snap = await getDocs(collection(db, name));
        collectionsData[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }

      const payload = buildBackupPayload(collectionsData, {
        exportedAt: new Date().toISOString(),
        exportedBy: getUsername(),
      });

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const stamp = payload.exportedAt.replace(/[:.]/g, '-');
      const filename = `iskonnect-backup-${stamp}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const collectionCount = Object.values(collectionsData).filter((docs) => docs.length > 0).length;
      setLastBackup({
        at: payload.exportedAt,
        totalDocuments: payload.totalDocuments,
        collectionCount,
        filename,
      });

      logAudit({
        action: 'EXPORT',
        collection: 'ALL',
        documentId: null,
        details: `Full database backup downloaded (${payload.totalDocuments} document(s) across ${collectionCount} collection(s)).`,
      });

      Swal.fire({
        icon: 'success',
        title: 'Backup downloaded',
        text: `${payload.totalDocuments} document(s) across ${collectionCount} collection(s).`,
        timer: 2800,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Backup failed', text: err?.message || 'Something went wrong while reading the database.' });
    } finally {
      setBackingUp(false);
    }
  };

  /* ── Restore: file selection + validation ── */
  const openFilePicker = () => fileInputRef.current?.click();

  const clearSelectedFile = () => {
    setFileName(null);
    setParsedBackup(null);
    setPreview(null);
    setSelectedCollections({});
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = validateBackupFile(parsed);
      if (!result.valid) {
        Swal.fire({ icon: 'error', title: 'Invalid backup file', text: result.error });
        return;
      }
      setParsedBackup(parsed);
      setPreview(result);
      setFileName(file.name);
      const initialSelection = {};
      result.summary.forEach((s) => { initialSelection[s.name] = true; });
      setSelectedCollections(initialSelection);
    } catch {
      Swal.fire({ icon: 'error', title: 'Could not read file', text: 'That file is not valid JSON.' });
    }
  };

  const toggleCollection = (name) => {
    setSelectedCollections((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  /* ── Restore: execution ── */
  const handleRestore = async () => {
    if (!parsedBackup || !preview) return;

    const namesToRestore = preview.summary.filter((s) => selectedCollections[s.name]).map((s) => s.name);
    if (namesToRestore.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Nothing selected', text: 'Choose at least one collection to restore.' });
      return;
    }
    const totalToRestore = preview.summary
      .filter((s) => namesToRestore.includes(s.name))
      .reduce((sum, s) => sum + s.count, 0);

    const exportedAtLabel = preview.exportedAt ? new Date(preview.exportedAt).toLocaleString() : 'an unknown time';

    const confirmResult = await Swal.fire({
      title: 'Confirm restore',
      html: `
        <div style="text-align:left; font-size:0.9rem;">
          <p>This adds/updates <strong>${totalToRestore}</strong> document(s) across
          <strong>${namesToRestore.length}</strong> collection(s) from a backup dated
          <strong>${exportedAtLabel}</strong>.</p>
          <p>Existing data is <strong>not</strong> deleted — records are only added or
          overwritten where a matching document already exists.</p>
          <p>Type <strong>RESTORE</strong> below to continue.</p>
        </div>
      `,
      input: 'text',
      inputPlaceholder: 'Type RESTORE to confirm',
      showCancelButton: true,
      confirmButtonText: 'Restore',
      confirmButtonColor: 'var(--danger)',
      preConfirm: (value) => {
        if (value !== 'RESTORE') {
          Swal.showValidationMessage('Type RESTORE exactly (all caps) to confirm.');
          return false;
        }
        return true;
      },
    });
    if (!confirmResult.isConfirmed) return;

    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) {
      Swal.fire({ icon: 'error', title: 'Not connected', text: 'Firestore is not configured in this environment.' });
      return;
    }

    setRestoring(true);
    Swal.fire({
      title: 'Restoring…',
      html: `0 / ${totalToRestore} documents restored…`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    let written = 0;
    try {
      for (const name of namesToRestore) {
        const docs = parsedBackup.collections[name] || [];
        for (const chunk of chunkArray(docs, 400)) {
          const batch = writeBatch(db);
          chunk.forEach((entry) => {
            const { id, ...data } = entry;
            batch.set(doc(db, name, id), data, { merge: true });
          });
          await batch.commit();
          written += chunk.length;
          Swal.update({ html: `${written} / ${totalToRestore} documents restored…` });
        }
      }

      logAudit({
        action: 'RESTORE',
        collection: namesToRestore.join(', '),
        documentId: null,
        details: `Restored ${written} document(s) across ${namesToRestore.length} collection(s) from a backup dated ${preview.exportedAt || 'an unknown time'}.`,
      });

      Swal.fire({
        icon: 'success',
        title: 'Restore complete',
        text: `${written} document(s) restored across ${namesToRestore.length} collection(s).`,
      });
      clearSelectedFile();
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Restore failed partway through',
        text: `${written} document(s) were written before this error: ${err?.message || 'unknown error'}. Some documents may already be restored — re-check your data before retrying.`,
      });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="page backup-restore-page">
      <Header
        title="Database Backup &amp; Restore"
        subtitle="Download a full snapshot of the database, or restore records from a previous backup"
        onMenuClick={onMenuClick}
      />

      <div className="page-content">
        {/* Backup */}
        <div className="section-card">
          <div className="section-header">
            <h3><DownloadCloud size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />Create Backup</h3>
          </div>
          <p className="br-description">
            Downloads every record in the database — scholars, applicants, school years, events,
            messages, announcements, system configuration, and archived history — as a single
            JSON file to your computer.
          </p>
          <button className="btn btn-primary" onClick={handleBackup} disabled={backingUp}>
            <DownloadCloud size={16} /> {backingUp ? 'Preparing backup…' : 'Download Backup'}
          </button>

          {lastBackup && (
            <div className="br-last-backup">
              <CheckCircle size={16} color="#10b981" />
              <span>
                Downloaded <strong>{lastBackup.filename}</strong> — {lastBackup.totalDocuments} document(s)
                across {lastBackup.collectionCount} collection(s), {new Date(lastBackup.at).toLocaleString()}.
              </span>
            </div>
          )}
        </div>

        {/* Automatic Backups */}
        <div className="section-card">
          <div className="section-header">
            <h3><Clock size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />Automatic Backups</h3>
          </div>
          <p className="br-description">
            Runs on a schedule server-side, independent of anyone having the admin panel open —
            checked once a day and performed whenever a week/month has passed since the last run.
            Covers the same data as a manual backup except the audit trail (kept out to stay well
            under Firestore&apos;s per-document size limit); download the manual backup above if
            you need the audit trail included. The last {SCHEDULED_BACKUPS_RETAINED} automatic
            backups are kept, downloadable below.
          </p>

          <div className="br-frequency-row">
            {['off', 'weekly', 'monthly'].map((f) => (
              <label key={f} className={`br-frequency-chip ${frequencyChoice === f ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="backup-frequency"
                  value={f}
                  checked={frequencyChoice === f}
                  onChange={() => setFrequencyChoice(f)}
                />
                {FREQUENCY_LABELS[f]}
              </label>
            ))}
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSaveSchedule}
              disabled={savingSchedule || frequencyChoice === (schedule?.frequency || 'off')}
            >
              {savingSchedule ? 'Saving…' : 'Save Schedule'}
            </button>
          </div>

          <p className="br-schedule-status">
            {schedule?.frequency && schedule.frequency !== 'off' ? (
              schedule.lastRunAt ? (
                <>Currently <strong>{FREQUENCY_LABELS[schedule.frequency]}</strong> — last ran{' '}
                  {new Date(schedule.lastRunAt).toLocaleString()} ({schedule.lastRunTotalDocuments} document(s)).</>
              ) : (
                <>Currently <strong>{FREQUENCY_LABELS[schedule.frequency]}</strong> — hasn&apos;t run yet
                  (checked once a day; the first run happens within 24 hours).</>
              )
            ) : (
              <>Automatic backups are currently <strong>off</strong>.</>
            )}
          </p>

          {pastRuns.length > 0 && (
            <div className="br-collection-list" style={{ marginTop: 12 }}>
              {pastRuns.map((run) => (
                <div key={run.id} className="br-collection-row" style={{ cursor: 'default' }}>
                  <History size={14} />
                  <span className="br-collection-name" style={{ fontFamily: 'inherit' }}>
                    {run.exportedAt ? new Date(run.exportedAt).toLocaleString() : run.id}
                  </span>
                  <span className="br-collection-count">{run.totalDocuments} docs</span>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: 10 }}
                    onClick={() => handleDownloadPastRun(run)}
                    disabled={downloadingRunId === run.id}
                  >
                    <DownloadCloud size={13} /> Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Restore */}
        <div className="section-card">
          <div className="section-header">
            <h3><UploadCloud size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />Restore from Backup</h3>
          </div>

          <div className="info-note">
            <AlertTriangle size={16} />
            <span>
              Restoring adds and updates records from the backup file — it never deletes anything
              currently in the database. If a record was changed after the backup was taken, the
              backup&apos;s version will overwrite those later changes for whichever collections you select below.
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {!fileName ? (
            <button className="btn btn-secondary" onClick={openFilePicker} style={{ marginTop: 16 }}>
              <FileJson size={16} /> Choose Backup File
            </button>
          ) : (
            <div className="br-file-chosen">
              <div className="br-file-chosen-row">
                <FileJson size={16} />
                <strong>{fileName}</strong>
                <button className="br-clear-btn" onClick={clearSelectedFile} title="Remove selected file">
                  <X size={14} />
                </button>
              </div>

              {preview && (
                <>
                  <p className="br-preview-meta">
                    Backed up {preview.exportedAt ? new Date(preview.exportedAt).toLocaleString() : 'at an unknown time'}
                    {preview.exportedBy ? ` by ${preview.exportedBy}` : ''} · {preview.totalDocuments} document(s) total
                  </p>

                  <div className="br-collection-list">
                    {preview.summary.map((s) => (
                      <label key={s.name} className="br-collection-row">
                        <input
                          type="checkbox"
                          checked={!!selectedCollections[s.name]}
                          onChange={() => toggleCollection(s.name)}
                        />
                        <span className="br-collection-name">{s.name}</span>
                        <span className="br-collection-count">{s.count} doc{s.count !== 1 ? 's' : ''}</span>
                      </label>
                    ))}
                  </div>

                  <button className="btn btn-danger" onClick={handleRestore} disabled={restoring} style={{ marginTop: 16 }}>
                    <UploadCloud size={16} /> {restoring ? 'Restoring…' : 'Restore Selected Collections'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .backup-restore-page .page-content { max-width: 760px; }
        .backup-restore-page .section-header h3 { display: flex; align-items: center; }
        .br-description {
          color: var(--text-secondary);
          font-size: 0.9rem;
          line-height: 1.5;
          margin: 0 0 16px;
        }
        .br-last-backup {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-top: 16px;
          padding: 12px 14px;
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.25);
          border-radius: var(--radius-sm);
          font-size: 0.85rem;
          color: var(--text-secondary);
        }
        .br-last-backup svg { flex-shrink: 0; margin-top: 2px; }
        .br-frequency-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .br-frequency-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 16px;
          border-radius: 999px;
          cursor: pointer;
          border: 1.5px solid var(--border-color);
          background: var(--bg-secondary);
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 500;
          transition: all 0.15s;
          user-select: none;
        }
        .br-frequency-chip:hover { border-color: var(--primary-color); color: var(--primary-light); }
        .br-frequency-chip.selected {
          border-color: var(--primary-color);
          background: rgba(45, 149, 150, 0.15);
          color: var(--primary-light);
          font-weight: 700;
        }
        .br-frequency-chip input { accent-color: var(--primary); }
        .br-schedule-status {
          margin: 14px 0 0;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }
        .br-file-chosen { margin-top: 16px; }
        .br-file-chosen-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 0.9rem;
        }
        .br-clear-btn {
          margin-left: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border: none;
          border-radius: 50%;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
        }
        .br-clear-btn:hover { background: var(--hover-bg); color: var(--text-primary); }
        .br-preview-meta {
          margin: 10px 0 0;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }
        .br-collection-list {
          margin-top: 10px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }
        .br-collection-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 14px;
          font-size: 0.85rem;
          color: var(--text-primary);
          cursor: pointer;
          border-bottom: 1px solid var(--border-color);
        }
        .br-collection-row:last-child { border-bottom: none; }
        .br-collection-row:hover { background: var(--hover-bg); }
        .br-collection-name { font-family: monospace; }
        .br-collection-count {
          margin-left: auto;
          color: var(--text-secondary);
          font-size: 0.78rem;
        }
      `}</style>
    </div>
  );
}
