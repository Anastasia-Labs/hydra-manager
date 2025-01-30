import type { HydraHead } from "@hydra-manager/cli/hydra/head"

export type Choice<Value> = {
  value: Value
  name?: string
  description?: string
  short?: string
  disabled?: boolean | string
  type?: never
}

export type ActionCallback = (hydraHead: HydraHead) => Promise<void>

export type Action = {
  name: string
  value: ActionCallback
}
