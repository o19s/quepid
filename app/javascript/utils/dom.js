// A terse DOM builder: element("div", { className, text }, children).
export function element(tag, { className, text } = {}, children = []) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  node.append(...children)
  return node
}
