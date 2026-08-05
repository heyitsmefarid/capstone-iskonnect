import Swal from 'sweetalert2';

// Shared prompts for the applicant-evaluation screen.
//
// These replace six near-identical Swal.fire calls that each rendered a bare
// number box or an unstyled <select>. Two problems with that: the evaluator
// could not see WHICH applicant they were scoring, and the rubric dropdown
// showed only "20 pts — Complete & Organized" while the descriptions and the
// Cedula/electric-bill ranges that actually define each level stayed on the
// reference table above, out of view while choosing.

// Rubric labels and descriptions are admin-authored (Administration >
// Evaluation Criteria) and go into innerHTML here, so they must be escaped.
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const subtitleHtml = (subtitle) =>
  subtitle ? `<p class="score-dialog-sub">${escapeHtml(subtitle)}</p>` : '';

/**
 * Numeric score prompt (Examination, and custom criteria scored 0–100).
 * Resolves to a Number, or undefined if cancelled.
 */
export async function promptScore({ title, subtitle, current, max = 100 }) {
  const hasCurrent = current !== undefined && current !== null && current !== '';
  const { value } = await Swal.fire({
    title,
    html: `
      ${subtitleHtml(subtitle)}
      <label class="score-dialog-label" for="score-dialog-input">Score (0–${max})</label>
      <input id="score-dialog-input" type="number" inputmode="decimal"
             min="0" max="${max}" step="0.1" placeholder="0"
             class="score-dialog-input" value="${hasCurrent ? escapeHtml(current) : ''}" />
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: hasCurrent ? 'Update score' : 'Save score',
    cancelButtonText: 'Cancel',
    customClass: { popup: 'score-dialog' },
    didOpen: () => {
      const el = document.getElementById('score-dialog-input');
      el?.focus();
      el?.select();
      // Enter should submit rather than do nothing.
      el?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') Swal.clickConfirm();
      });
    },
    preConfirm: () => {
      const raw = document.getElementById('score-dialog-input')?.value ?? '';
      if (raw.trim() === '') {
        Swal.showValidationMessage('Please enter a score');
        return false;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > max) {
        Swal.showValidationMessage(`Score must be between 0 and ${max}`);
        return false;
      }
      return n;
    },
  });
  return value;
}

/**
 * Rubric-level picker (Completion of Requirements, Economic Background, and
 * custom rubric criteria). Shows every level's points, name, description and —
 * for Economic Background — its Cedula/electric-bill bands, so the criteria are
 * visible while choosing instead of only in the table behind the dialog.
 * Resolves to the selected points as a Number, or undefined if cancelled.
 */
export async function promptRubricLevel({ title, subtitle, rubric, current, showRanges = false }) {
  const levels = [...(rubric || [])].sort((a, b) => b.points - a.points);
  if (levels.length === 0) {
    await Swal.fire({
      icon: 'warning',
      title: 'No scoring levels configured',
      text: 'Add at least one level under Administration > System Settings > Evaluation Criteria.',
    });
    return undefined;
  }

  const hasCurrent = current !== undefined && current !== null;
  const options = levels.map((r) => {
    const checked = hasCurrent && Number(r.points) === Number(current);
    const ranges = showRanges
      ? `<span class="rubric-option-meta">Cedula: ${escapeHtml(r.cedula || '—')}
           &nbsp;·&nbsp; Bills: ${escapeHtml(r.electric || '—')}</span>`
      : '';
    const desc = r.description
      ? `<span class="rubric-option-desc">${escapeHtml(r.description)}</span>`
      : '';
    return `
      <label class="rubric-option${checked ? ' is-selected' : ''}">
        <input type="radio" name="rubric-level" value="${escapeHtml(r.points)}" ${checked ? 'checked' : ''} />
        <span class="rubric-option-pts">${escapeHtml(r.points)}</span>
        <span class="rubric-option-body">
          <span class="rubric-option-label">${escapeHtml(r.label)}</span>
          ${ranges}
          ${desc}
        </span>
      </label>`;
  }).join('');

  const { value } = await Swal.fire({
    title,
    html: `${subtitleHtml(subtitle)}<div class="rubric-options">${options}</div>`,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: hasCurrent ? 'Update level' : 'Save level',
    cancelButtonText: 'Cancel',
    width: 620,
    customClass: { popup: 'score-dialog rubric-dialog' },
    didOpen: () => {
      const popup = Swal.getPopup();
      // Keep the highlight in sync with the actual selection.
      popup.querySelectorAll('.rubric-option').forEach((el) => {
        el.addEventListener('click', () => {
          popup.querySelectorAll('.rubric-option').forEach((o) => o.classList.remove('is-selected'));
          el.classList.add('is-selected');
        });
      });
      popup.querySelector('.rubric-option.is-selected')?.scrollIntoView({ block: 'nearest' });
    },
    preConfirm: () => {
      const picked = Swal.getPopup().querySelector('input[name="rubric-level"]:checked');
      if (!picked) {
        Swal.showValidationMessage('Please select a level');
        return false;
      }
      return Number(picked.value);
    },
  });
  return value;
}
