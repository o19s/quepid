// Shared rendering contract; each controller owns and releases its message timers.
export function withStatusMessages(Base) {
  return class extends Base {
    showStatusMessage(
      el,
      { message, html, className, variantClass, variantClasses, autoHideMs, onExpire } = {}
    ) {
      if (!el) return

      const useHtml = html !== undefined
      const content = useHtml ? html : (message ?? "")
      this.statusTimers ||= new Map()
      clearTimeout(this.statusTimers.get(el))
      this.statusTimers.delete(el)

      if (useHtml) {
        // eslint-disable-next-line quepid/stimulus-conventions -- Callers supply status icon/spinner fragments, never a page or modal shell.
        el.innerHTML = content
      } else {
        el.textContent = content
      }

      if (className !== undefined) {
        el.className = className
      } else {
        if (variantClasses) el.classList.remove(...variantClasses)
        if (variantClass) el.classList.add(variantClass)
      }

      if (autoHideMs) {
        const timer = setTimeout(() => {
          this.statusTimers.delete(el)

          if (onExpire) {
            onExpire(el)
          } else if (useHtml) {
            el.replaceChildren()
          } else {
            el.textContent = ""
          }
        }, autoHideMs)
        this.statusTimers.set(el, timer)
      }
    }

    disconnect() {
      this.statusTimers?.forEach((timer) => clearTimeout(timer))
      this.statusTimers?.clear()
      super.disconnect?.()
    }
  }
}
