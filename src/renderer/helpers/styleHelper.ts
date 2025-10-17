// Z-index map for consistent layering across the application
type ZIndexKey = 'footer' | 'header'
type ZIndexMap = {
  [key in ZIndexKey]: number
}

export const Z_INDEX_MAP: ZIndexMap = {
  header: 1001,
  footer: 1000
}
