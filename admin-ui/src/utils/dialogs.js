/**
 * Reusable confirm dialog utility using SweetAlert2.
 * Encapsulates the common pattern used across Applications,
 * Announcements, Scholars, Attendance, Evaluation, and Messages pages.
 */
import Swal from 'sweetalert2';

/**
 * Show a confirm-then-act dialog.
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.text
 * @param {'warning'|'question'|'info'} [options.icon='warning']
 * @param {string} [options.confirmText='Confirm']
 * @param {string} [options.confirmColor='#2d9596']
 * @param {() => void | Promise<void>} options.onConfirm
 * @param {{ title: string, text: string }} [options.success]
 */
export async function confirmAction({
  title,
  text,
  icon = 'warning',
  confirmText = 'Confirm',
  confirmColor = '#2d9596',
  onConfirm,
  success,
}) {
  const result = await Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonColor: confirmColor,
    cancelButtonColor: '#6b7280',
    confirmButtonText: confirmText,
  });

  if (result.isConfirmed) {
    await onConfirm();

    if (success) {
      Swal.fire({
        icon: 'success',
        title: success.title,
        text: success.text,
        timer: 1500,
        showConfirmButton: false,
      });
    }
  }

  return result.isConfirmed;
}

/**
 * Show a quick success toast.
 */
export function showSuccess(title, text) {
  return Swal.fire({
    icon: 'success',
    title,
    text,
    timer: 1500,
    showConfirmButton: false,
  });
}

/**
 * Show a warning alert.
 */
export function showWarning(title, text) {
  return Swal.fire({
    icon: 'warning',
    title,
    text,
  });
}
