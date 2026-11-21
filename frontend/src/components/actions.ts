/** One entry in an actions menu. Adding an action to a menu means adding one of these. */
export type Action<T> = {
  label: string
  isAvailable: (item: T) => boolean
  run: (item: T) => void
}
