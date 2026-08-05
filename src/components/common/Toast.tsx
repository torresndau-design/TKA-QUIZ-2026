import Swal from 'sweetalert2';

export const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

export const showToast = (title: string, icon: 'success' | 'error' | 'warning' | 'info' = 'success') => {
  Toast.fire({
    icon,
    title,
  });
};

export const showConfirmDialog = async (title: string, text: string): Promise<boolean> => {
  const result = await Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#2563EB',
    cancelButtonColor: '#EF4444',
    confirmButtonText: 'Ya, Lanjutkan',
    cancelButtonText: 'Batal',
    customClass: {
      popup: 'rounded-2xl border border-slate-200 dark:bg-slate-800 dark:text-slate-100',
    },
  });
  return result.isConfirmed;
};
