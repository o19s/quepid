import { getCoreCapabilities } from "utils/core_capability_access"

// Named entry points preserve the controller contract. All groups are built
// together by the workspace factory, with no lazy service registration.
export async function getBootstrapCapabilities() {
  return getCoreCapabilities().caseRuntime.bootstrap
}

export async function getSnapshotCapabilities() {
  return getCoreCapabilities().caseRuntime.snapshots
}

export async function getWizardCapabilities() {
  return getCoreCapabilities().caseRuntime.wizard
}

export async function getTuneRelevanceCapabilities() {
  return getCoreCapabilities().caseRuntime.tuneRelevance
}
