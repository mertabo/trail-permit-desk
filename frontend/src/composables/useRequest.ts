import { ref, shallowRef } from 'vue'
import { errorMessage } from '@/errorMessages'
import { ApiError } from '@/services/api'
import { useToast } from './useToast'

/**
 * Calls a service function and tracks its loading state, result and error code.
 * On error, shows the plain-language message for the code in the toast.
 */
export function useRequest<Args extends unknown[], Result>(service: (...args: Args) => Promise<Result>) {
  const data = shallowRef<Result | null>(null)
  const loading = ref(false)
  const errorCode = ref<string | null>(null)
  const { showError } = useToast()

  async function run(...args: Args): Promise<Result | null> {
    loading.value = true
    errorCode.value = null
    try {
      data.value = await service(...args)
      return data.value
    } catch (error) {
      errorCode.value = error instanceof ApiError ? error.code : 'UNKNOWN_ERROR'
      showError(errorMessage(errorCode.value))
      return null
    } finally {
      loading.value = false
    }
  }

  return { data, loading, errorCode, run }
}
