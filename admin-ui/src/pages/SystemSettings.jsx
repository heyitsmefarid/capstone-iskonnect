import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  Settings, Bell, Shield, Save, RotateCcw, Plus, Trash2, Edit2,
  School, BookOpen, Activity, Flag, CheckCircle, RefreshCw, CreditCard,
} from 'lucide-react';
import Header from '../components/layout/Header';
import { useApp } from '../context/AppContext';
import { uploadFile, isFileSizeAllowed } from '../services/cloudinaryUpload';
import {
  getConfig, setConfig as saveConfig,
  getCollection, addItem, updateItem, deleteItem,
  seedIfEmpty, resetCollection,
} from '../services/localSettingsStore';

const TABS = [
  { id: 'config',    label: 'General Config',   icon: Settings },
  { id: 'schools',   label: 'Eligible Schools',  icon: School },
  { id: 'programs',  label: 'Academic Programs', icon: BookOpen },
  { id: 'statuses',  label: 'Scholarship Statuses', icon: Activity },
  { id: 'stages',    label: 'Timeline Stages',   icon: Flag },
  { id: 'idCardTemplate', label: 'ID Card Template', icon: CreditCard },
];

// Reads an uploaded image's natural pixel dimensions before it's uploaded —
// needed to compute frontAspectRatio/backAspectRatio so the scholar app can
// render the background at the right proportions.
function readImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = reject;
    img.src = url;
  });
}

const COL_MAP = {
  schools:  'schools',
  programs: 'programs',
  statuses: 'scholarship_statuses',
  stages:   'timeline_stages',
};

// Tabs whose data lives in Firestore (shared with every device + the scholar
// app). The rest (statuses, stages) stay in this browser's local settings.
const FIRESTORE_TABS = ['schools', 'programs'];

export default function SystemSettings() {
  const { onMenuClick } = useOutletContext() || {};
  const {
    systemSettings,
    updateSystemSettings,
    catalogSchools, catalogPrograms,
    addCatalogItem, updateCatalogItem, deleteCatalogItem, resetCatalogToDefaults,
    idCardTemplate, saveIdCardTemplate, deactivateIdCardTemplate,
  } = useApp();
  const [activeTab, setActiveTab] = useState('config');

  const [config, setConfig] = useState({
    organizationName: 'Calapan City Education Department',
    contactEmail: 'ced@calapancity.gov.ph',
    scholarshipCap: 25000,
    numberOfSemesters: 8,
    sessionTimeoutMinutes: 60,
    enableAutoEvaluation: true,
    requireQrSignature: true,
    enablePushNotifications: true,
    allowApplicantResubmission: true,
  });

  const [data, setData] = useState({ schools: [], programs: [], statuses: [], stages: [] });
  const [editModal, setEditModal] = useState({ open: false, tab: '', item: null });
  const [formValues, setFormValues] = useState({});
  const [programSchoolFilter, setProgramSchoolFilter] = useState('');

  // Scholar ID card template — the images/mayor-name the scholar app composites
  // onto a scholar's digital ID card.
  const [templateForm, setTemplateForm] = useState({
    frontBackgroundUrl: '', frontAspectRatio: null,
    backBackgroundUrl: '', backAspectRatio: null,
    mayorName: '', mayorSignatureUrl: '',
    primaryLogoUrl: '', secondaryLogoUrl: '',
  });
  const [templateUploading, setTemplateUploading] = useState('');

  // statuses/stages remain local; schools/programs come live from Firestore.
  const loadSettings = useCallback(() => {
    seedIfEmpty();
    const saved = getConfig();
    if (Object.keys(saved).length) setConfig(prev => ({ ...prev, ...saved }));
    setData(prev => ({
      ...prev,
      statuses: getCollection('statuses'),
      stages:   getCollection('stages'),
    }));
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // Number of Semesters is persisted in the shared, Firestore-backed
  // `systemSettings` (that's what the Scholars/Evaluation pages read). Seed the
  // form from it so the field always shows the real saved value instead of this
  // browser's local default — otherwise the form can display 8 while the rest of
  // the app uses a different stored value (e.g. 9), and they silently disagree.
  useEffect(() => {
    if (systemSettings?.numberOfSemesters != null) {
      setConfig(prev => ({ ...prev, numberOfSemesters: systemSettings.numberOfSemesters }));
    }
  }, [systemSettings?.numberOfSemesters]);

  // Keep the Firestore-backed catalog in sync with the table data.
  useEffect(() => {
    setData(prev => ({ ...prev, schools: catalogSchools, programs: catalogPrograms }));
  }, [catalogSchools, catalogPrograms]);

  // Seed the ID card template form from whatever is currently saved/active, so
  // re-opening the tab shows the real active template instead of a blank form.
  useEffect(() => {
    if (idCardTemplate) setTemplateForm(prev => ({ ...prev, ...idCardTemplate }));
  }, [idCardTemplate]);

  const handleTemplateImageUpload = async (field, aspectField, file) => {
    if (!file) return;
    if (!isFileSizeAllowed(file.size)) {
      Swal.fire({ icon: 'warning', title: 'File too large', text: `"${file.name}" is over the 10 MB limit.` });
      return;
    }
    setTemplateUploading(field);
    try {
      const url = await uploadFile(file);
      if (!url) {
        Swal.fire({ icon: 'error', title: 'Upload failed', text: 'Could not upload the image.' });
        return;
      }
      const update = { [field]: url };
      if (aspectField) {
        try {
          const { width, height } = await readImageDimensions(file);
          update[aspectField] = height > 0 ? width / height : null;
        } catch {
          update[aspectField] = null;
        }
      }
      setTemplateForm(prev => ({ ...prev, ...update }));
    } finally {
      setTemplateUploading('');
    }
  };

  const handleActivateTemplate = async () => {
    try {
      await saveIdCardTemplate(templateForm);
      Swal.fire({ icon: 'success', title: 'Template activated', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ title: 'Activation failed', text: err?.message || 'Could not save the template.', icon: 'error' });
    }
  };

  const handleDeactivateTemplate = async () => {
    const result = await Swal.fire({
      title: 'Deactivate ID card template?',
      text: 'Every scholar will immediately fall back to the plain, template-less ID card until a template is activated again.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--danger)',
      confirmButtonText: 'Yes, Deactivate',
    });
    if (!result.isConfirmed) return;
    try {
      await deactivateIdCardTemplate();
      Swal.fire({ icon: 'success', title: 'Template deactivated', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ title: 'Deactivation failed', text: err?.message || 'Could not deactivate the template.', icon: 'error' });
    }
  };

  const handleSaveConfig = () => {
    saveConfig(config);
    updateSystemSettings(config);
    Swal.fire({ title: 'Saved', text: 'Configuration updated.', icon: 'success', timer: 1500, showConfirmButton: false });
  };

  const openAdd  = (tab) => { setFormValues({}); setEditModal({ open: true, tab, item: null }); };
  const openEdit = (tab, item) => { setFormValues({ ...item }); setEditModal({ open: true, tab, item }); };
  const closeModal = () => setEditModal({ open: false, tab: '', item: null });

  const handleSaveItem = async () => {
    const { tab, item } = editModal;
    if (!formValues.name?.trim()) {
      Swal.fire({ title: 'Name is required', icon: 'warning', timer: 1500, showConfirmButton: false });
      return;
    }
    try {
      if (FIRESTORE_TABS.includes(tab)) {
        if (item) await updateCatalogItem(tab, item.id, formValues);
        else await addCatalogItem(tab, formValues);
        // The Firestore listener refreshes the table automatically.
      } else {
        if (item) updateItem(tab, item.id, formValues);
        else addItem(tab, formValues);
        loadSettings();
      }
      closeModal();
      Swal.fire({ title: 'Saved', icon: 'success', timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ title: 'Save failed', text: err?.message || 'Could not save.', icon: 'error' });
    }
  };

  const handleResetDefaults = async (tab) => {
    const tabLabel = TABS.find(t => t.id === tab)?.label || tab;
    const result = await Swal.fire({
      title: `Reset ${tabLabel}?`,
      text: 'This will replace all current entries with the official default list. This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--danger)',
      confirmButtonText: 'Yes, Reset',
    });
    if (!result.isConfirmed) return;
    try {
      if (FIRESTORE_TABS.includes(tab)) {
        await resetCatalogToDefaults();
      } else {
        resetCollection(tab);
        loadSettings();
      }
      Swal.fire({ title: 'Reset Complete', text: `${tabLabel} restored to official defaults.`, icon: 'success', timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ title: 'Reset failed', text: err?.message || 'Could not reset.', icon: 'error' });
    }
  };

  const handleDelete = async (tab, item) => {
    const confirmed = await Swal.fire({
      title: 'Delete this item?',
      text: `"${item.name}" will be removed.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--danger)',
      confirmButtonText: 'Delete',
    });
    if (!confirmed.isConfirmed) return;
    try {
      if (FIRESTORE_TABS.includes(tab)) {
        await deleteCatalogItem(tab, item.id);
      } else {
        deleteItem(tab, item.id);
        loadSettings();
      }
    } catch (err) {
      Swal.fire({ title: 'Delete failed', text: err?.message || 'Could not delete.', icon: 'error' });
    }
  };

  /* ── field definitions ─────────────────────────────────── */
  const getFields = (tab) => {
    switch (tab) {
      case 'schools':
        return [
          { key: 'name', label: 'School Name' },
        ];
      case 'programs':
        return [
          { key: 'name',       label: 'Program Name' },
          { key: 'school',     label: 'School',        type: 'school-select' },
          { key: 'tuitionCap', label: 'Tuition Cap (₱)', type: 'number' },
        ];
      case 'statuses':
        return [
          { key: 'name',  label: 'Status Label' },
          { key: 'code',  label: 'Code' },
          { key: 'color', label: 'Color', type: 'color' },
        ];
      case 'stages':
        return [
          { key: 'name',  label: 'Stage Name' },
          { key: 'code',  label: 'Code' },
          { key: 'color', label: 'Color', type: 'color' },
          { key: 'order', label: 'Order',  type: 'number' },
        ];
      default:
        return [{ key: 'name', label: 'Name' }];
    }
  };

  /* ── table display columns (subset of fields) ──────────── */
  const getTableFields = (tab) => {
    switch (tab) {
      case 'schools':
        return [{ key: 'name', label: 'School Name' }];
      case 'programs':
        return [
          { key: 'name',       label: 'Program Name' },
          { key: 'school',     label: 'School' },
          { key: 'tuitionCap', label: 'Tuition Cap (₱)' },
        ];
      default:
        return getFields(tab);
    }
  };

  /* ── config tab ────────────────────────────────────────── */
  const renderConfigTab = () => (
    <div className="settings-grid">
      <section className="settings-section">
        <div className="section-header-row"><Settings size={18} /><h3>General</h3></div>
        <div className="settings-form">
          {[
            ['organizationName',  'Organization Name',      'text'],
            ['contactEmail',      'Contact Email',          'email'],
            ['scholarshipCap',    'Scholarship Cap (₱)',    'number'],
            ['numberOfSemesters', 'Number of Semesters',    'number'],
          ].map(([field, label, type]) => (
            <div className="form-group" key={field}>
              <label>{label}</label>
              <input
                type={type}
                value={config[field] ?? ''}
                onChange={e => setConfig(p => ({
                  ...p, [field]: type === 'number' ? Number(e.target.value) : e.target.value,
                }))}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="section-header-row"><Shield size={18} /><h3>Security &amp; Workflow</h3></div>
        <div className="settings-form">
          <div className="form-group">
            <label>Session Timeout (minutes)</label>
            <input
              type="number" min="10" max="720"
              value={config.sessionTimeoutMinutes}
              onChange={e => setConfig(p => ({ ...p, sessionTimeoutMinutes: Number(e.target.value) || 60 }))}
            />
          </div>
          {[
            ['enableAutoEvaluation',    'Enable automatic scholar evaluation flags'],
            ['requireQrSignature',      'Require QR signature validation during offline sync'],
            ['allowApplicantResubmission', 'Allow applicant requirement resubmission'],
          ].map(([field, label]) => (
            <label className="checkbox-row" key={field}>
              <input
                type="checkbox"
                checked={!!config[field]}
                onChange={e => setConfig(p => ({ ...p, [field]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="section-header-row"><Bell size={18} /><h3>Notifications</h3></div>
        <div className="settings-form">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={!!config.enablePushNotifications}
              onChange={e => setConfig(p => ({ ...p, enablePushNotifications: e.target.checked }))}
            />
            Enable push notifications for announcements and messages
          </label>
        </div>
      </section>

      <div className="config-actions">
        <button className="btn btn-primary" onClick={handleSaveConfig}>
          <Save size={16} /> Save Configuration
        </button>
        <button className="btn btn-secondary" onClick={loadSettings}>
          <RotateCcw size={16} /> Reload
        </button>
      </div>
    </div>
  );

  /* ── ID card template tab ──────────────────────────────── */
  const TEMPLATE_IMAGE_FIELDS = [
    { field: 'frontBackgroundUrl', aspectField: 'frontAspectRatio', label: 'Front Background' },
    { field: 'backBackgroundUrl',  aspectField: 'backAspectRatio',  label: 'Back Background' },
    { field: 'mayorSignatureUrl',  aspectField: null, label: "Mayor's Signature" },
    { field: 'primaryLogoUrl',     aspectField: null, label: 'Primary Logo' },
    { field: 'secondaryLogoUrl',   aspectField: null, label: 'Secondary Logo' },
  ];

  const renderIdCardTemplateTab = () => (
    <div className="settings-grid">
      <section className="settings-section">
        <div className="section-header-row"><CreditCard size={18} /><h3>ID Card Images</h3></div>
        <div className="settings-form">
          {TEMPLATE_IMAGE_FIELDS.map(({ field, aspectField, label }) => (
            <div className="form-group" key={field}>
              <label>{label}</label>
              <input
                type="file"
                accept="image/*"
                disabled={templateUploading === field}
                onChange={e => handleTemplateImageUpload(field, aspectField, e.target.files[0])}
              />
              {templateUploading === field && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Uploading…</span>
              )}
              {templateForm[field] && templateUploading !== field && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                  Current: {templateForm[field]}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="section-header-row"><Settings size={18} /><h3>Mayor Details</h3></div>
        <div className="settings-form">
          <div className="form-group">
            <label>Mayor's Name</label>
            <input
              type="text"
              value={templateForm.mayorName}
              onChange={e => setTemplateForm(prev => ({ ...prev, mayorName: e.target.value }))}
              placeholder="Hon. Juan Dela Cruz"
            />
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="section-header-row"><CreditCard size={18} /><h3>Preview</h3></div>
        <div className="settings-form">
          {!templateForm.frontBackgroundUrl && !templateForm.backBackgroundUrl ? (
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              Upload a front/back background above to preview it here.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              {templateForm.frontBackgroundUrl && (
                <div>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Front</p>
                  <img src={templateForm.frontBackgroundUrl} alt="ID card front background preview" style={{ maxWidth: 300 }} />
                </div>
              )}
              {templateForm.backBackgroundUrl && (
                <div>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Back</p>
                  <img src={templateForm.backBackgroundUrl} alt="ID card back background preview" style={{ maxWidth: 300 }} />
                </div>
              )}
            </div>
          )}
          {templateForm.mayorName && (
            <p style={{ marginTop: '0.75rem', marginBottom: 0 }}>Mayor: {templateForm.mayorName}</p>
          )}
        </div>
      </section>

      <div className="config-actions">
        <button className="btn btn-primary" onClick={handleActivateTemplate}>
          <Save size={16} /> Activate Template
        </button>
        {idCardTemplate?.isActive && (
          <button className="btn btn-danger" onClick={handleDeactivateTemplate}>
            <Trash2 size={16} /> Deactivate Template
          </button>
        )}
      </div>
    </div>
  );

  /* ── collection table tab ──────────────────────────────── */
  const renderCollectionTab = (tab) => {
    let items = data[tab] || [];
    if (tab === 'programs' && programSchoolFilter) {
      items = items.filter(i => i.school === programSchoolFilter);
    }
    const tableFields = getTableFields(tab);

    return (
      <div>
        {tab === 'programs' && (
          <div style={{ marginBottom: 12 }}>
            <select
              value={programSchoolFilter}
              onChange={e => setProgramSchoolFilter(e.target.value)}
              style={{ minWidth: 280 }}
            >
              <option value="">All Schools ({(data.programs || []).length} programs)</option>
              {(data.schools || []).map(s => {
                const count = (data.programs || []).filter(p => p.school === s.name).length;
                return <option key={s.id} value={s.name}>{s.name} ({count})</option>;
              })}
            </select>
          </div>
        )}
        <div className="collection-header">
          <h3 className="collection-title">{TABS.find(t => t.id === tab)?.label}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {(tab === 'schools' || tab === 'programs') && (
              <button
                className="btn btn-secondary"
                onClick={() => handleResetDefaults(tab)}
                title="Reset to official default list"
              >
                <RefreshCw size={15} /> Reset to Defaults
              </button>
            )}
            <button className="btn btn-primary" onClick={() => openAdd(tab)}>
              <Plus size={16} /> Add New
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                {tableFields.map(f => <th key={f.key}>{f.label}</th>)}
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={tableFields.length + 2} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                    No items yet. Click "Add New" to create one.
                  </td>
                </tr>
              )}
              {items.map(item => (
                <tr key={item.id}>
                  {tableFields.map(f => (
                    <td key={f.key}>
                      {f.key === 'color'
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 16, height: 16, borderRadius: 4, background: item.color, display: 'inline-block' }} />
                            {item.color}
                          </span>
                        : f.key === 'tuitionCap' && item[f.key] != null
                          ? `₱${Number(item[f.key]).toLocaleString()}`
                          : item[f.key] ?? '—'}
                    </td>
                  ))}
                  <td>
                    <span className={`status-badge ${item.active !== false ? 'approved' : 'rejected'}`}>
                      {item.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(tab, item)}>
                        <Edit2 size={13} /> Edit
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(tab, item)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  /* ── add/edit modal ────────────────────────────────────── */
  const renderEditModal = () => {
    if (!editModal.open) return null;
    const { tab, item } = editModal;
    const fields = getFields(tab);

    return (
      <div className="modal-overlay" onClick={closeModal}>
        <div className="modal-box" onClick={e => e.stopPropagation()}>
          <h3 className="modal-title">{item ? 'Edit Item' : 'Add New Item'}</h3>
          <div className="modal-form">
            {fields.map(f => (
              <div className="form-group" key={f.key}>
                <label>{f.label}</label>

                {f.type === 'color' ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={formValues[f.key] || '#2d9596'}
                      onChange={e => setFormValues(p => ({ ...p, [f.key]: e.target.value }))}
                      style={{ width: 44, height: 38, padding: 2, cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={formValues[f.key] || ''}
                      onChange={e => setFormValues(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder="#2d9596"
                    />
                  </div>
                ) : f.type === 'school-select' ? (
                  <select
                    value={formValues[f.key] || ''}
                    onChange={e => setFormValues(p => ({ ...p, [f.key]: e.target.value }))}
                  >
                    <option value="">— Select school —</option>
                    {data.schools.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={formValues[f.key] ?? ''}
                    onChange={e => setFormValues(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.label}
                  />
                )}
              </div>
            ))}

            <div className="form-group">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={formValues.active !== false}
                  onChange={e => setFormValues(p => ({ ...p, active: e.target.checked }))}
                />
                Active
              </label>
            </div>
          </div>

          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveItem}>
              <CheckCircle size={15} /> Save
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page system-settings-page">
      <Header
        title="System Settings"
        subtitle="Manage schools, programs, statuses, and platform configuration"
        onMenuClick={onMenuClick}
      />

      <div className="page-content">
        <div className="settings-tabs">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="tab-content-panel">
          {activeTab === 'config' && renderConfigTab()}
          {activeTab === 'idCardTemplate' && renderIdCardTemplateTab()}
          {activeTab !== 'config' && activeTab !== 'idCardTemplate' && renderCollectionTab(activeTab)}
        </div>
      </div>

      {renderEditModal()}

      <style>{`
        .settings-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 0.5rem;
        }
        .settings-tab {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border: 1px solid transparent;
          border-radius: var(--radius-sm);
          background: none;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.15s;
        }
        .settings-tab:hover { background: var(--bg-secondary); color: var(--text-primary); }
        .settings-tab.active {
          background: rgba(45, 149, 150, 0.1);
          color: var(--primary);
          border-color: var(--primary);
        }
        .tab-content-panel { min-height: 300px; }
        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1.5rem;
        }
        .settings-section {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius);
          padding: 1.5rem;
        }
        .section-header-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
          color: var(--text-primary);
        }
        .section-header-row h3 { margin: 0; font-size: 1rem; }
        .settings-form { display: flex; flex-direction: column; gap: 1rem; }
        .config-actions {
          grid-column: 1 / -1;
          display: flex;
          gap: 1rem;
          padding-top: 0.5rem;
        }
        .checkbox-row {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          font-size: 0.9rem;
          color: var(--text-secondary);
          cursor: pointer;
        }
        .checkbox-row input { width: auto; accent-color: var(--primary); }
        .collection-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
        }
        .collection-title {
          margin: 0;
          font-size: 1.1rem;
          color: var(--text-primary);
        }
        .table-container {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius);
          overflow-x: auto;
        }
        .loading-bar {
          height: 3px;
          background: linear-gradient(90deg, var(--primary), transparent);
          animation: loading-slide 1.2s infinite;
          margin-bottom: 0.5rem;
        }
        @keyframes loading-slide {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000;
        }
        .modal-box {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius);
          padding: 2rem;
          min-width: 380px;
          max-width: 520px;
          width: 100%;
        }
        .modal-title {
          margin: 0 0 1.25rem;
          font-size: 1.1rem;
          color: var(--text-primary);
        }
        .modal-form { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }
        .btn-danger { background: var(--danger); color: #fff; border: none; }
        .btn-danger:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}
