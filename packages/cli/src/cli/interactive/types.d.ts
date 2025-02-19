import type { HydraHead } from "@hydra-manager/cli/hydra/head"
import type { Monitor } from "./actions/monitor.ts"

export type Choice<Value> = {
  value: Value
  name?: string
  description?: string
  short?: string
  disabled?: boolean | string
  type?: never
}

export type CronConfig = {
  monitor: Monitor
  chosenParticipant: string
  interval: number
}

export type ActionCallback = (hydraHead: HydraHead) => Promise<void>

export type Action = {
  name: string
  value: ActionCallback
}

export type CronAction = {
  name: string
  value: (cronConfig?: CronConfig | undefined) => ActionCallback
}
