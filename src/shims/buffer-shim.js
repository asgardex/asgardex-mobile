// ✅ src/shims/custom-buffer-shim.js
import { Buffer as NodeBuffer } from 'node:buffer'

export const Buffer = NodeBuffer
export default NodeBuffer
