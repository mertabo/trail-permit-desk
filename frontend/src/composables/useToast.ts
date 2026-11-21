import { ref } from 'vue'

type Toast = { id: number; message: string; variant: 'success' | 'danger' }

// Shared by the whole app, so there is only ever one toast. A new one replaces the old one.
const toast = ref<Toast | null>(null)
let hideTimer: ReturnType<typeof setTimeout> | undefined

function show(message: string, variant: Toast['variant']) {
  toast.value = { id: Date.now(), message, variant }
  clearTimeout(hideTimer)
  hideTimer = setTimeout(hide, 6000)
}

function hide() {
  clearTimeout(hideTimer)
  toast.value = null
}

export function useToast() {
  return {
    toast,
    showSuccess: (message: string) => show(message, 'success'),
    showError: (message: string) => show(message, 'danger'),
    hide,
  }
}
