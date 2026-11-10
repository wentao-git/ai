/** 错误提示条：统一所有页面的错误视觉（有 message 才渲染，调用处不需要 if） */
export function ErrorAlert({ message }: { message: string }) {
  if (!message) return null
  return <p className="error">{message}</p>
}
