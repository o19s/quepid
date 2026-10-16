import { application } from "controllers/application"

// Asks through the layout's shared confirm modal (shared/_confirm_modal), falling
// back to native confirm until it connects. Resolves true only on Confirm.
// style colours the Confirm button: "danger" (default) or "primary".
// Not for use from inside another open modal: Bootstrap does not stack modals.
export function confirmDialog(message, style) {
  const element = document.getElementById("confirmModal")
  const dialog =
    element && application.getControllerForElementAndIdentifier(element, "confirm-dialog")
  return dialog ? dialog.ask(message, style) : Promise.resolve(window.confirm(message))
}
