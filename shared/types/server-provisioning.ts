export interface ServerProvisioningConfig {
  serverId: string
  serverUuid: string
  eggId: string
  nodeId: string
  allocationId: string
  environment?: Record<string, string>
  additionalAllocationIds?: string[]
  mountIds?: string[]
  dockerImageOverride?: string
  dockerCredentials?: {
    registry?: string
    username?: string
    password?: string
    imagePullPolicy?: string
  }
}

export interface ServerProvisioningContext<
  TServer = unknown,
  TLimits = unknown,
  TEgg = unknown,
  TAllocation = unknown,
  TAdditionalAllocation = TAllocation,
  TEggVariable = unknown,
  TMount = unknown,
  TWingsNode = unknown,
> {
  wingsNode: TWingsNode
  server: TServer
  limits: TLimits
  egg: TEgg
  allocation: TAllocation
  additionalAllocations: TAdditionalAllocation[]
  eggVariables: TEggVariable[]
  mounts: TMount[]
}
