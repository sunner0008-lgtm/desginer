import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: true,
  theme: 'neutral',
  securityLevel: 'loose',
  fontFamily: 'Inter, system-ui, sans-serif',
});

interface MermaidProps {
  chart: string;
}

const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && chart) {
      mermaid.contentLoaded();
      // We need to clear the previous content and re-render
      ref.current.removeAttribute('data-processed');
      mermaid.render('mermaid-svg-' + Math.random().toString(36).substr(2, 9), chart)
        .then(({ svg }) => {
          if (ref.current) {
            ref.current.innerHTML = svg;
          }
        })
        .catch((err) => {
          console.error('Mermaid render error:', err);
          if (ref.current) {
            ref.current.innerHTML = `<div class="text-red-500 text-xs p-4 border border-red-200 rounded bg-red-50-50">
              <p class="font-bold">流程图渲染失败</p>
              <p>可能是生成的 Mermaid 语法有误。请尝试重新生成。</p>
            </div>`;
          }
        });
    }
  }, [chart]);

  return <div key={chart} ref={ref} className="mermaid flex justify-center overflow-x-auto p-4 bg-white rounded-xl border border-black/5 shadow-sm" />;
};

export default Mermaid;
