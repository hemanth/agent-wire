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

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  className = ''
}) => {
  const highlightedHtml = useMemo(() => {
    const langKey =
      language === 'curl' ? 'bash' : language === 'js' ? 'javascript' : language;
    const grammar = Prism.languages[langKey] || Prism.languages.bash;
    return Prism.highlight(code.trim(), grammar, langKey);
  }, [code, language]);

  return (
    <pre
      className={`font-mono leading-relaxed overflow-x-auto ${className}`}
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
    />
  );
};
