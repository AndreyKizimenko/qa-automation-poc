/**
 * The toast copy specs expect, in one place: when Fleet rewords a toast, one
 * line changes here instead of every spec that waits for it. Specs pass these
 * to `toast.expectSuccess` / `toast.expectError` (`suite/no-toast-copy-in-spec`
 * fails on copy typed in a spec); a page object's action may also wait for its
 * own toast.
 *
 * Grouped by area. An entry is the text Fleet renders, or a builder for copy
 * that names something; each says where Fleet emits it, so a new entry is
 * checked against the source, not copied from a screenshot. Copy Fleet's server
 * writes and the frontend relays is marked as such.
 */
export const toastCopy = {
  reports: {
    /** frontend/pages/queries/ManageQueriesPage/ManageQueriesPage.tsx, after the automations modal saves. */
    automationsUpdated: 'Successfully updated report automations.',
  },
  software: {
    /** frontend/pages/SoftwarePage/SoftwarePage.tsx, after the vulnerability automations modal saves. */
    vulnerabilityAutomationsUpdated: 'Successfully updated vulnerability automations.',
  },
  scripts: {
    /** The scripts library's upload modal, on a script Fleet accepted. */
    uploaded: 'Successfully uploaded.',
  },
  variables: {
    /** frontend/pages/ManageControlsPage/Variables/components/DeleteCustomVariableModal. */
    deleted: 'Variable successfully deleted.',
    /** The server's refusal of a script naming a variable that doesn't exist (`ValidateEmbeddedSecrets`), relayed by the upload modal. */
    missingForScript: (name: string) => `Couldn't add. Variable "$FLEET_SECRET_${name}" doesn't exist.`,
    /** The server's refusal (409) to delete a variable a library script on Unassigned uses, relayed by the delete modal. */
    usedByUnassignedScript: (name: string, script: string) =>
      `Couldn't delete. ${name} is used by the "${script}" script in the "Unassigned" fleet. Please edit or delete the script and try again.`,
  },
} as const;
