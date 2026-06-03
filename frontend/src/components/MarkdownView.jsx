import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

export default function MarkdownView({ content }) {
  return (
    <div className="prose prose-sm max-w-none">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }) {
            const lang = /language-(\w+)/.exec(className || '')?.[1]
            return !inline && lang ? (
              <SyntaxHighlighter style={oneLight} language={lang} PreTag="div" {...props}>
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className="bg-gray-100 text-blue-700 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                {children}
              </code>
            )
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}
