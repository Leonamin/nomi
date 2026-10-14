import type { z } from 'zod'
import type { CapabilityApprovalSubject } from '../electron/shared/agentCapabilities/capabilityApprovalPolicy'

/** Model-facing tools are supplied by the shared semantic registry. */
export type AgentTool = { name: string; description: string; schema: z.ZodTypeAny; approvalSubject: CapabilityApprovalSubject; hasDomainConfirmation?: boolean; run: (input: unknown) => Promise<unknown> }
