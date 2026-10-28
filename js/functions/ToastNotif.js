/* ==========================================================================
   Toast Notification Helper
   ========================================================================== */
export function showToast(message) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className =
      'fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl bg-stone-900 text-white text-xs sm:text-sm font-semibold shadow-2xl border border-stone-700 flex items-center gap-2 transform transition-all duration-300 translate-y-20 opacity-0';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `
    <svg class="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
    <span>${message}</span>
  `;
  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3200);
}
