import React, { useMemo } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';

interface CodeBlockProps {
  code: string;
  language: 'bash' | 'curl' | 'json' | 'javascript' | 'js' | 'python';
  className?: string;
}

const MAX_HIGHLIGHT_LENGTH = 8192;

function renderTokens(tokens: Array<string | Prism.Token>, keyPrefix = 't'): React.ReactNode {
  return tokens.map((token, index) => {
    if (typeof token === 'string') {
      return token;
    }
    const alias = Array.isArray(token.alias) ? token.alias.join(' ') : token.alias || '';
    const cls = `token ${token.type}${alias ? ` ${alias}` : ''}`;
    const key = `${keyPrefix}-${index}`;
    const children = Array.isArray(token.content)
      ? renderTokens(token.content as Array<string | Prism.Token>, key)
      : typeof token.content === 'object' && token.content !== null
      ? renderTokens([token.content as Prism.Token], key)
      : String(token.content);
    return (
      <span key={key} className={cls}>
        {children}
      </span>
    );
  });
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  className = ''
}) => {
  const renderedContent = useMemo(() => {
    const trimmed = code.trim();
    if (trimmed.length > MAX_HIGHLIGHT_LENGTH) {
      return trimmed;
    }
    const langKey =
      language === 'curl' ? 'bash' : language === 'js' ? 'javascript' : language;
    const grammar = Prism.languages[langKey] || Prism.languages.bash;
    const tokens = Prism.tokenize(trimmed, grammar);
    return renderTokens(tokens);
  }, [code, language]);

  return (
    <pre
      tabIndex={0}
      role="region"
      aria-label={`${language} code snippet`}
      className={`font-mono leading-relaxed overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded ${className}`}
    >
      {renderedContent}
    </pre>
  );
};
