// Shared URL helper — joins the Quepid root URL with a relative path.
// Ensures no double slashes and never produces a bare "/" prefix when
// rootUrl is empty. Per CLAUDE.md: "urls generated should never start with /
// as we need relative links."

export function apiUrl(path) {
  const root = document.body.dataset.quepidRootUrl || ""
  // Strip leading slash from path so we get relative URLs when root is empty
  const relativePath = path.replace(/^\//, "")
  if (root === "") {
    return relativePath
  }
  // Ensure exactly one slash between root and path
  return root.replace(/\/+$/, "") + "/" + relativePath
}

export function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")
}
