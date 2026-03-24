/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';

// Set worker for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { scoreGameDesign, ScoringResult, rewriteGameDesign, generateFlowchart } from './services/geminiService';
import Mermaid from './components/Mermaid';
import { cn } from './lib/utils';
import { 
  FileText, 
  Send, 
  BarChart3, 
  Lightbulb, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ChevronRight,
  RefreshCcw,
  Trophy,
  Download,
  FileJson,
  FileCode,
  History,
  Clock,
  Trash2,
  Upload,
  FileUp,
  Sparkles,
  Copy,
  Check,
  X,
  GitBranch
} from 'lucide-react';

export interface HistoryItem {
  id: string;
  timestamp: number;
  content: string;
  result: ScoringResult;
}

export default function App() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoringResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCriterion, setActiveCriterion] = useState<string | null>(null);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [currentLoadingStep, setCurrentLoadingStep] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [rewrittenContent, setRewrittenContent] = useState<string | null>(null);
  const [rewriting, setRewriting] = useState(false);
  const [flowchart, setFlowchart] = useState<string | null>(null);
  const [generatingFlowchart, setGeneratingFlowchart] = useState(false);
  const [rewriteStrategy, setRewriteStrategy] = useState<'balanced' | 'creative' | 'technical'>('balanced');
  const [adoptedSuggestions, setAdoptedSuggestions] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [outputFormat, setOutputFormat] = useState<'detailed' | 'summary' | 'table'>('detailed');

  const MAX_HISTORY = 5;

  useEffect(() => {
    const savedHistory = localStorage.getItem('game_design_scorer_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  const saveToHistory = (newContent: string, newResult: ScoringResult) => {
    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      content: newContent,
      result: newResult
    };
    const updatedHistory = [newItem, ...history].slice(0, MAX_HISTORY);
    setHistory(updatedHistory);
    localStorage.setItem('game_design_scorer_history', JSON.stringify(updatedHistory));
  };

  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('game_design_scorer_history', JSON.stringify(updatedHistory));
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setContent(item.content);
    setResult(item.result);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10B981'; // emerald-500
    if (score >= 60) return '#F59E0B'; // amber-500
    return '#EF4444'; // red-500
  };

  const getScoreBgClass = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getScoreTextClass = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'docx') {
        reader.onload = async (event) => {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          setContent(result.value);
          setLoading(false);
        };
        reader.readAsArrayBuffer(file);
      } else if (extension === 'xlsx' || extension === 'xls') {
        reader.onload = (event) => {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const text = XLSX.utils.sheet_to_txt(worksheet);
          setContent(text);
          setLoading(false);
        };
        reader.readAsArrayBuffer(file);
      } else if (extension === 'txt') {
        reader.onload = (event) => {
          setContent(event.target?.result as string);
          setLoading(false);
        };
        reader.readAsText(file);
      } else if (extension === 'pdf') {
        reader.onload = async (event) => {
          try {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            let fullText = '';
            
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
              fullText += pageText + '\n';
            }
            
            setContent(fullText);
            setLoading(false);
          } catch (err) {
            console.error('PDF extraction error:', err);
            setError('解析 PDF 文件失败。');
            setLoading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        setError('不支持的文件格式。请上传 .docx, .xlsx, .pdf 或 .txt 文件。');
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError('读取文件失败。');
      setLoading(false);
    }
    
    // Reset input
    e.target.value = '';
  };

  const tips = [
    "儿童游戏的重点是好玩和直观，不要设计过于复杂的系统。",
    "核心循环（Core Loop）越简单越好，确保孩子们能立刻理解。",
    "体感操作的反馈必须及时且夸张，给予孩子强烈的成就感。",
    "不要用成人的硬核标准来衡量儿童游戏，趣味性永远是第一位的。",
    "正向激励（如音效、特效、称赞）是让儿童保持兴趣的关键。",
    "游戏中的每一个机制都应该为核心的趣味体验服务。",
    "避免复杂的数值计算和经济系统，让游戏回归纯粹的快乐。",
    "优秀的儿童游戏往往能在潜移默化中锻炼认知和反应能力。",
    "奖励不仅是分数的提升，更是情感和视觉上的满足。",
    "简洁（Simplicity）往往比复杂更难实现，但也更有效。"
  ];

  const loadingSteps = [
    "正在读取策划文档...",
    "正在提取核心玩法循环...",
    "正在评估趣味性与吸引力...",
    "正在分析体感交互与反馈...",
    "正在考量儿童认知与成长要素...",
    "正在生成深度优化建议..."
  ];

  useEffect(() => {
    let tipInterval: NodeJS.Timeout;
    let stepInterval: NodeJS.Timeout;
    if (loading) {
      setCurrentTipIndex(0);
      setCurrentLoadingStep(0);
      
      tipInterval = setInterval(() => {
        setCurrentTipIndex((prev) => (prev + 1) % tips.length);
      }, 3000);
      
      stepInterval = setInterval(() => {
        setCurrentLoadingStep((prev) => Math.min(prev + 1, loadingSteps.length - 1));
      }, 2000);
    }
    return () => {
      clearInterval(tipInterval);
      clearInterval(stepInterval);
    };
  }, [loading]);

  const handleScore = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setError(null);
    setAdoptedSuggestions([]);
    try {
      const scoringResult = await scoreGameDesign(content);
      setResult(scoringResult);
      saveToHistory(content, scoringResult);
    } catch (err) {
      console.error(err);
      setError('Failed to analyze the document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setContent('');
    setError(null);
    setRewrittenContent(null);
    setFlowchart(null);
    setAdoptedSuggestions([]);
  };

  const toggleAdoptSuggestion = (suggestion: string) => {
    setAdoptedSuggestions(prev => 
      prev.includes(suggestion) 
        ? prev.filter(s => s !== suggestion)
        : [...prev, suggestion]
    );
  };

  const handleGenerateFlowchart = async () => {
    if (!content) return;
    setGeneratingFlowchart(true);
    try {
      const chart = await generateFlowchart(content);
      setFlowchart(chart);
    } catch (err) {
      console.error(err);
      setError('生成流程图失败，请重试。');
    } finally {
      setGeneratingFlowchart(false);
    }
  };

  const handleRewrite = async () => {
    if (!content || !result) return;
    setRewriting(true);
    try {
      const optimized = await rewriteGameDesign(content, result, rewriteStrategy, adoptedSuggestions);
      setRewrittenContent(optimized);
    } catch (err) {
      console.error(err);
      setError('优化改写失败，请重试。');
    } finally {
      setRewriting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportAsJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `游戏策划评估报告_${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsMarkdown = () => {
    if (!result) return;
    let md = `# 游戏策划评估报告\n\n`;
    md += `## 综合评分: ${result.overallScore}/100\n\n`;
    md += `### 执行摘要\n${result.summary}\n\n`;
    md += `## 各项指标分析\n\n`;
    result.criteria.forEach(c => {
      md += `### ${c.name} (${c.score}/100)\n`;
      md += `**核心反馈**: ${c.feedback}\n\n`;
      md += `**评分理由**: ${c.explanation}\n\n`;
      md += `**改进建议**:\n`;
      c.actionableSuggestions.forEach(s => md += `- ${s}\n`);
      md += `\n`;
    });
    md += `## 全局改进建议\n`;
    result.suggestions.forEach(s => md += `- ${s}\n`);
    
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `游戏策划评估报告_${new Date().getTime()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] selection:bg-indigo-100">
      {/* Header */}
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-serif italic text-xl tracking-tight">游戏策划打分器</h1>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-black/40 uppercase tracking-widest">
            <span>版本 1.0.0</span>
            <div className="w-1 h-1 rounded-full bg-black/20" />
            <span>AI 驱动</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto"
            >
              <div className="text-center mb-12">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">
                  提升你的 <span className="text-indigo-600">儿童体感游戏设计</span>
                </h2>
                <p className="text-black/60 text-lg">
                  在下方粘贴你的游戏设计文档 (GDD) 或开发需求。
                  我们的 AI 顾问将从趣味性、核心循环和交互反馈等方面进行深度分析。
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-xl shadow-black/5 border border-black/5 overflow-hidden">
                <div className="p-4 border-b border-black/5 bg-black/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-xs font-mono text-black/40 uppercase tracking-wider">
                      <FileText className="w-4 h-4" />
                      <span>文档内容</span>
                    </div>
                    <div className="h-4 w-px bg-black/10" />
                    <div className="flex bg-black/5 rounded-lg p-0.5">
                      <button
                        onClick={() => setIsPreviewMode(false)}
                        className={cn(
                          "px-3 py-1 text-xs font-medium rounded-md transition-all",
                          !isPreviewMode ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black"
                        )}
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => setIsPreviewMode(true)}
                        className={cn(
                          "px-3 py-1 text-xs font-medium rounded-md transition-all",
                          isPreviewMode ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black"
                        )}
                      >
                        预览
                      </button>
                    </div>
                    <div className="h-4 w-px bg-black/10" />
                    <label className="flex items-center gap-1.5 text-xs font-mono text-indigo-600 hover:text-indigo-700 cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>上传文件 (.docx, .xlsx, .pdf)</span>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".docx,.xlsx,.xls,.txt,.pdf"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                  <span className="text-[10px] font-mono text-black/30">
                    {content.length} 字符
                  </span>
                </div>
                
                {isPreviewMode ? (
                  <div className="w-full h-80 p-6 overflow-y-auto bg-gray-50/50">
                    {content ? (
                      <div className="markdown-body">
                        <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-black/30 text-sm">
                        暂无内容预览
                      </div>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="在此粘贴你的 GDD... 支持 Markdown 格式。例如：&#10;&#10;# 游戏标题：魔法森林大冒险&#10;**类型**：儿童体感跑酷&#10;&#10;## 核心循环&#10;- 挥手跳跃&#10;- 躲避障碍物&#10;- 收集魔法星星"
                    className="w-full h-80 p-6 focus:outline-none resize-none text-sm leading-relaxed font-sans"
                  />
                )}
                <div className="p-4 bg-black/[0.02] border-t border-black/5 flex justify-between items-center">
                  <button
                    onClick={() => setContent(`游戏标题：魔法森林大冒险
类型：儿童体感跑酷
平台：智能电视 / 体感设备
目标受众：4-8岁儿童

核心概念：
一款通过身体动作控制角色的跑酷游戏。玩家扮演一个在魔法森林中探险的小精灵。

核心特性：
1. 体感操作：玩家通过原地踏步控制角色奔跑，向上跳跃控制角色跳过树根，左右挥手收集漂浮的魔法星星。
2. 趣味反馈：每次成功收集星星，都会有清脆的“叮当”声和绚丽的星光特效。
3. 认知成长：沿途会遇到需要根据颜色分类的魔法果实，寓教于乐。`)}
                    className="text-xs font-mono text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    加载示例文档
                  </button>
                  <button
                    onClick={handleScore}
                    disabled={loading || !content.trim()}
                    className={cn(
                      "px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all",
                      loading || !content.trim() 
                        ? "bg-black/10 text-black/40 cursor-not-allowed" 
                        : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-200"
                    )}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        分析中...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        开始分析
                      </>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-6 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-4 shadow-sm"
                >
                  <div className="p-2 bg-red-100 rounded-full text-red-600 flex-shrink-0 mt-0.5">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-red-800 font-bold text-lg mb-1">分析过程中出现问题</h4>
                    <p className="text-red-600/90 text-sm leading-relaxed mb-4">{error}</p>
                    <div className="flex gap-3">
                      <button 
                        onClick={handleScore}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors shadow-sm"
                      >
                        重试分析
                      </button>
                      <button 
                        onClick={() => setError(null)}
                        className="px-4 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-xl hover:bg-red-200 transition-colors"
                      >
                        关闭提示
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 flex flex-col items-center justify-center py-12"
                >
                  <div className="relative w-24 h-24 mb-8">
                    <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-indigo-600 animate-pulse" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-4 text-indigo-900 text-center">
                    {loadingSteps[currentLoadingStep]}
                  </h3>
                  <div className="w-64 h-2 bg-black/5 rounded-full overflow-hidden mb-8">
                    <motion.div
                      className="h-full bg-indigo-600 rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: `${((currentLoadingStep + 1) / loadingSteps.length) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="inline-flex items-center gap-3 px-6 py-3 bg-indigo-50 border border-indigo-100 rounded-2xl shadow-sm max-w-md">
                    <Lightbulb className="w-5 h-5 text-indigo-600 animate-pulse flex-shrink-0" />
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={currentTipIndex}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="text-sm text-indigo-900 font-medium text-left"
                      >
                        {tips[currentTipIndex]}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {/* History Section */}
              {history.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-12"
                >
                  <div className="flex items-center gap-2 mb-6 px-2">
                    <History className="w-4 h-4 text-black/40" />
                    <h3 className="text-xs font-mono text-black/40 uppercase tracking-widest">最近的分析记录</h3>
                  </div>
                  <div className="space-y-3">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => loadHistoryItem(item)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            loadHistoryItem(item);
                          }
                        }}
                        className="w-full text-left bg-white p-4 rounded-2xl border border-black/5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-4 overflow-hidden">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-600 transition-colors">
                            <span className="text-indigo-600 font-bold group-hover:text-white transition-colors">
                              {item.result.overallScore}
                            </span>
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-sm font-medium text-black/80 truncate mb-0.5">
                              {item.content.split('\n')[0].replace('游戏标题：', '').replace('Game Title: ', '') || '未命名项目'}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-black/30 font-mono">
                              <Clock className="w-3 h-3" />
                              {new Date(item.timestamp).toLocaleString('zh-CN', { 
                                month: 'short', 
                                day: 'numeric', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => deleteHistoryItem(e, item.id)}
                          className="p-2 text-black/20 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Left Column: Stats & Overview */}
              <div className="lg:col-span-5 space-y-8">
                <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-xl shadow-black/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 flex items-center gap-2">
                    <div className="flex items-center bg-black/5 rounded-full p-1">
                      <button 
                        onClick={handleRewrite}
                        disabled={rewriting}
                        title="优化改写文档"
                        className={cn(
                          "p-1.5 rounded-full transition-all",
                          rewriting ? "animate-pulse text-indigo-400" : "text-black/40 hover:bg-white hover:text-indigo-600"
                        )}
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                      <div className="w-px h-3 bg-black/10 mx-1" />
                      <button 
                        onClick={exportAsJSON}
                        title="导出为 JSON"
                        className="p-1.5 hover:bg-white rounded-full transition-all text-black/40 hover:text-indigo-600"
                      >
                        <FileJson className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={exportAsMarkdown}
                        title="导出为 Markdown"
                        className="p-1.5 hover:bg-white rounded-full transition-all text-black/40 hover:text-indigo-600"
                      >
                        <FileCode className="w-4 h-4" />
                      </button>
                    </div>
                    <button 
                      onClick={reset}
                      title="重置"
                      className="p-2 hover:bg-black/5 rounded-full transition-colors text-black/40"
                    >
                      <RefreshCcw className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="mb-8">
                    <span className="text-xs font-mono text-black/40 uppercase tracking-widest block mb-2">综合评分</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-7xl font-bold tracking-tighter text-indigo-600">{result.overallScore}</span>
                      <span className="text-2xl font-medium text-black/20">/100</span>
                    </div>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                        className="w-full h-full"
                      >
                        <RadarChart 
                          cx="50%" 
                          cy="50%" 
                          outerRadius="80%" 
                          data={result.criteria.map(c => ({
                            ...c,
                            highlightScore: c.name === activeCriterion ? c.score : 0
                          }))}
                          onMouseMove={(e) => {
                            if (e && e.activeLabel) {
                              setActiveCriterion(String(e.activeLabel));
                            }
                          }}
                          onMouseLeave={() => setActiveCriterion(null)}
                        >
                        <PolarGrid stroke="#E5E7EB" />
                        <PolarAngleAxis 
                          dataKey="name" 
                          tick={(props) => {
                            const { x, y, payload, textAnchor } = props;
                            const isActive = payload.value === activeCriterion;
                            const criterion = result.criteria.find(c => c.name === payload.value);
                            const scoreColor = criterion ? getScoreColor(criterion.score) : '#6B7280';
                            
                            return (
                              <g>
                                <text 
                                  x={x} 
                                  y={y} 
                                  textAnchor={textAnchor} 
                                  fontSize={10} 
                                  fill={isActive ? scoreColor : '#6B7280'}
                                  fontWeight={isActive ? '700' : '400'}
                                  className={cn(
                                    "transition-all duration-300 radar-label",
                                    `radar-label-${payload.value.toLowerCase().replace(/\s+/g, '-')}`
                                  )}
                                >
                                  {payload.value}
                                </text>
                              </g>
                            );
                          }} 
                        />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const scoreColor = getScoreColor(data.score);
                              return (
                                <div className="bg-white/95 backdrop-blur-sm p-3 border border-black/5 shadow-2xl rounded-xl max-w-[200px] animate-in fade-in zoom-in duration-200">
                                  <p className="font-bold text-xs mb-1" style={{ color: scoreColor }}>{data.name}</p>
                                  <p className="text-xl font-bold mb-2" style={{ color: scoreColor }}>{data.score}<span className="text-[10px] text-black/20 ml-1">/100</span></p>
                                  <p className="text-[10px] text-black/60 leading-relaxed italic">“{data.feedback}”</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Radar
                          name="评分"
                          dataKey="score"
                          stroke="#4F46E5"
                          fill="#4F46E5"
                          fillOpacity={0.2}
                          className="radar-main-area"
                          isAnimationActive={true}
                          animationDuration={1200}
                          animationBegin={300}
                          animationEasing="ease-out"
                          dot={(props) => {
                            const { cx, cy, payload, index } = props;
                            const isActive = payload.name === activeCriterion;
                            const scoreColor = getScoreColor(payload.score);
                            return (
                              <motion.circle 
                                initial={{ r: 0, opacity: 0 }}
                                animate={{ 
                                  r: isActive ? 5 : 3, 
                                  opacity: isActive ? 1 : 0.6 
                                }}
                                transition={{ 
                                  delay: 0.5 + (index * 0.1),
                                  duration: 0.4,
                                  type: "spring",
                                  stiffness: 260,
                                  damping: 20
                                }}
                                cx={cx} 
                                cy={cy} 
                                fill={scoreColor} 
                                stroke="#fff" 
                                strokeWidth={isActive ? 2 : 1}
                                className={cn(
                                  "transition-all duration-300 radar-dot",
                                  `radar-dot-${payload.name.toLowerCase().replace(/\s+/g, '-')}`
                                )}
                              />
                            );
                          }}
                        />
                        <Radar
                          name="Highlight"
                          dataKey="highlightScore"
                          stroke="transparent"
                          fill="#4F46E5"
                          fillOpacity={activeCriterion ? 0.3 : 0}
                          animationDuration={300}
                        />
                      </RadarChart>
                    </motion.div>
                  </ResponsiveContainer>
                </div>
                  
                  <div className="mt-6 px-2">
                    <p className="text-[11px] text-black/40 leading-relaxed">
                      <span className="font-bold text-indigo-600/60 mr-1">图表说明:</span>
                      该雷达图展示了策划案在五个核心维度的表现均衡度。覆盖面积越大代表整体质量越高；某个顶角越接近边缘，说明该项指标越突出；反之，靠近中心的凹陷处则是需要重点优化的薄弱环节。
                    </p>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-xl shadow-black/5">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-amber-500" />
                    核心改进建议
                  </h3>
                  <ul className="space-y-4">
                    {result.suggestions.map((suggestion, idx) => (
                      <li key={idx} className="flex gap-3 text-sm text-black/70 group items-start">
                        <div className="mt-1 w-5 h-5 rounded-full bg-amber-50 flex-shrink-0 flex items-center justify-center text-amber-600 font-mono text-[10px] group-hover:bg-amber-100 transition-colors">
                          {idx + 1}
                        </div>
                        <span className="flex-1">{suggestion}</span>
                        <button
                          onClick={() => toggleAdoptSuggestion(suggestion)}
                          className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-medium transition-all flex-shrink-0",
                            adoptedSuggestions.includes(suggestion)
                              ? "bg-green-100 text-green-700 border border-green-200"
                              : "bg-white text-amber-600 border border-amber-200 hover:bg-amber-50"
                          )}
                        >
                          {adoptedSuggestions.includes(suggestion) ? "已采纳" : "采纳"}
                        </button>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8 pt-6 border-t border-black/5">
                    <div className="mb-4">
                      <p className="text-[10px] uppercase tracking-widest text-black/40 font-mono mb-3 px-1">选择优化策略</p>
                      <div className="grid grid-cols-3 gap-2 p-1 bg-black/5 rounded-xl">
                        {[
                          { id: 'balanced', label: '均衡', icon: '⚖️' },
                          { id: 'creative', label: '创意', icon: '🎨' },
                          { id: 'technical', label: '技术', icon: '🛠️' }
                        ].map((s) => (
                          <button
                            key={s.id}
                            onClick={() => setRewriteStrategy(s.id as any)}
                            className={cn(
                              "py-2 px-1 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-1",
                              rewriteStrategy === s.id 
                                ? "bg-white text-indigo-600 shadow-sm scale-[1.02]" 
                                : "text-black/40 hover:text-black/60"
                            )}
                          >
                            <span className="text-sm">{s.icon}</span>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={handleRewrite}
                        disabled={rewriting}
                        className={cn(
                          "py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]",
                          rewriting 
                            ? "bg-black/5 text-black/40 cursor-not-allowed" 
                            : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                        )}
                      >
                        {rewriting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            正在优化...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            优化改写
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleGenerateFlowchart}
                        disabled={generatingFlowchart}
                        className={cn(
                          "py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]",
                          generatingFlowchart 
                            ? "bg-black/5 text-black/40 cursor-not-allowed" 
                            : "bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 shadow-sm"
                        )}
                      >
                        {generatingFlowchart ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            正在生成...
                          </>
                        ) : (
                          <>
                            <GitBranch className="w-4 h-4" />
                            逻辑流程图
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-center text-black/30 mt-3 font-mono">
                      基于分析建议自动重构文档或生成逻辑流程
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Detailed Feedback */}
              <div className="lg:col-span-7 space-y-8">
                <div className="flex bg-black/5 rounded-lg p-1 w-fit mb-2">
                  <button
                    onClick={() => setOutputFormat('detailed')}
                    className={cn(
                      "px-4 py-2 text-sm font-medium rounded-md transition-all",
                      outputFormat === 'detailed' ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black"
                    )}
                  >
                    详细报告
                  </button>
                  <button
                    onClick={() => setOutputFormat('summary')}
                    className={cn(
                      "px-4 py-2 text-sm font-medium rounded-md transition-all",
                      outputFormat === 'summary' ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black"
                    )}
                  >
                    摘要视图
                  </button>
                  <button
                    onClick={() => setOutputFormat('table')}
                    className={cn(
                      "px-4 py-2 text-sm font-medium rounded-md transition-all",
                      outputFormat === 'table' ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black"
                    )}
                  >
                    对比表格
                  </button>
                </div>

                {outputFormat === 'detailed' && (
                  <>
                    <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-xl shadow-black/5">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        执行摘要
                      </h3>
                      <div className="markdown-body text-black/70">
                        <Markdown remarkPlugins={[remarkGfm]}>{result.summary}</Markdown>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-xs font-mono text-black/40 uppercase tracking-widest px-2">各项指标深度分析</h3>
                      {result.criteria.map((item, idx) => (
                        <motion.div 
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          key={item.name} 
                          onMouseEnter={() => setActiveCriterion(item.name)}
                          onMouseLeave={() => setActiveCriterion(null)}
                          className={cn(
                            "bg-white p-6 rounded-2xl border transition-all duration-300 shadow-sm cursor-default",
                            activeCriterion === item.name 
                              ? "border-indigo-600 shadow-md scale-[1.02] z-10" 
                              : "border-black/5 hover:shadow-md"
                          )}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <h4 className={cn("font-bold", getScoreTextClass(item.score))}>{item.name}</h4>
                            <div className="flex items-center gap-2">
                              <div className="w-32 h-1.5 bg-black/5 rounded-full overflow-hidden">
                                <div 
                                  className={cn("h-full rounded-full transition-all duration-500", getScoreBgClass(item.score))} 
                                  style={{ width: `${item.score}%` }} 
                                />
                              </div>
                              <span className={cn("text-sm font-mono font-bold w-8 text-right", getScoreTextClass(item.score))}>{item.score}</span>
                            </div>
                          </div>
                          
                          <div className="space-y-5">
                            <div className="bg-black/[0.02] p-4 rounded-xl border border-black/5">
                              <p className="text-[10px] font-mono text-black/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-indigo-400" />
                                核心反馈
                              </p>
                              <p className="text-sm text-black/80 font-medium leading-relaxed">“{item.feedback}”</p>
                            </div>
                            
                            <div>
                              <p className="text-[10px] font-mono text-black/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-indigo-400" />
                                深度评分理由
                              </p>
                              <div className="text-sm text-black/60 leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-strong:text-indigo-600">
                                <Markdown remarkPlugins={[remarkGfm]}>{item.explanation}</Markdown>
                              </div>
                            </div>

                            <div className="pt-4 border-t border-black/5">
                              <p className="text-[10px] font-mono text-indigo-600/60 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3" />
                                针对性改进建议
                              </p>
                              <ul className="grid grid-cols-1 gap-2">
                                {item.actionableSuggestions.map((s, i) => (
                                  <li key={i} className="flex gap-3 text-xs text-black/60 bg-indigo-50/30 p-3 rounded-xl border border-indigo-100/50 hover:bg-indigo-50 transition-colors group items-start">
                                    <div className="w-5 h-5 rounded-lg bg-white border border-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-500 flex-shrink-0 group-hover:scale-110 transition-transform mt-0.5">
                                      {i + 1}
                                    </div>
                                    <span className="leading-relaxed flex-1">{s}</span>
                                    <button
                                      onClick={() => toggleAdoptSuggestion(s)}
                                      className={cn(
                                        "px-2 py-1 rounded-md text-[10px] font-medium transition-all flex-shrink-0",
                                        adoptedSuggestions.includes(s)
                                          ? "bg-green-100 text-green-700 border border-green-200"
                                          : "bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50"
                                      )}
                                    >
                                      {adoptedSuggestions.includes(s) ? "已采纳" : "采纳"}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </>
                )}

                {outputFormat === 'summary' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-xl shadow-black/5">
                      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        执行摘要
                      </h3>
                      <div className="markdown-body text-black/80 text-base leading-relaxed">
                        <Markdown remarkPlugins={[remarkGfm]}>{result.summary}</Markdown>
                      </div>
                    </div>
                    
                    <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-xl shadow-black/5">
                      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <Lightbulb className="w-6 h-6 text-amber-500" />
                        核心改进建议
                      </h3>
                      <ul className="space-y-4">
                        {result.suggestions.map((suggestion, idx) => (
                          <li key={idx} className="flex gap-4 text-base text-black/70 group items-start">
                            <div className="mt-1 w-6 h-6 rounded-full bg-amber-50 flex-shrink-0 flex items-center justify-center text-amber-600 font-mono text-xs group-hover:bg-amber-100 transition-colors">
                              {idx + 1}
                            </div>
                            <span className="leading-relaxed flex-1">{suggestion}</span>
                            <button
                              onClick={() => toggleAdoptSuggestion(suggestion)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0",
                                adoptedSuggestions.includes(suggestion)
                                  ? "bg-green-100 text-green-700 border border-green-200"
                                  : "bg-white text-amber-600 border border-amber-200 hover:bg-amber-50"
                              )}
                            >
                              {adoptedSuggestions.includes(suggestion) ? "已采纳" : "采纳"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}

                {outputFormat === 'table' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl shadow-xl shadow-black/5 border border-black/5 overflow-hidden"
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                          <tr className="bg-black/[0.02] border-b border-black/5">
                            <th className="p-5 font-bold text-black/60 text-sm whitespace-nowrap w-1/6">评估维度</th>
                            <th className="p-5 font-bold text-black/60 text-sm whitespace-nowrap w-24">得分</th>
                            <th className="p-5 font-bold text-black/60 text-sm w-1/3">核心评价</th>
                            <th className="p-5 font-bold text-black/60 text-sm w-1/3">改进建议</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                          {result.criteria.map((c, i) => (
                            <tr key={i} className="hover:bg-black/[0.01] transition-colors">
                              <td className="p-5 font-bold text-sm text-black/80 align-top">{c.name}</td>
                              <td className="p-5 align-top">
                                <span className={cn(
                                  "px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap", 
                                  getScoreBgClass(c.score).replace('bg-', 'bg-opacity-20 text-').replace('500', '700')
                                )}>
                                  {c.score} / 100
                                </span>
                              </td>
                              <td className="p-5 text-sm text-black/70 leading-relaxed align-top">
                                {c.feedback}
                              </td>
                              <td className="p-5 text-sm text-black/70 align-top">
                                <ul className="list-disc pl-4 space-y-2">
                                  {c.actionableSuggestions.map((s, j) => (
                                    <li key={j} className="leading-relaxed flex items-start justify-between gap-2 group">
                                      <span>{s}</span>
                                      <button
                                        onClick={() => toggleAdoptSuggestion(s)}
                                        className={cn(
                                          "px-2 py-0.5 rounded text-[10px] font-medium transition-all flex-shrink-0 opacity-0 group-hover:opacity-100",
                                          adoptedSuggestions.includes(s)
                                            ? "bg-green-100 text-green-700 border border-green-200 opacity-100"
                                            : "bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50"
                                        )}
                                      >
                                        {adoptedSuggestions.includes(s) ? "已采纳" : "采纳"}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Rewritten Content Modal */}
      <AnimatePresence>
        {rewrittenContent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRewrittenContent(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-black/5 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">AI 优化改写建议</h3>
                    <p className="text-xs text-black/40 font-mono">基于深度分析结果生成的专业版 GDD</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(rewrittenContent)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors text-sm font-medium"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? '已复制' : '复制全文'}
                  </button>
                  <button
                    onClick={() => setRewrittenContent(null)}
                    className="p-2 hover:bg-black/5 rounded-full transition-colors text-black/40"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 prose prose-sm max-w-none prose-indigo prose-headings:font-bold prose-headings:tracking-tight prose-p:text-black/70 prose-li:text-black/70">
                <div className="markdown-body">
                  <Markdown remarkPlugins={[remarkGfm]}>{rewrittenContent}</Markdown>
                </div>
              </div>

              <div className="p-6 bg-black/[0.02] border-t border-black/5 flex justify-center">
                <button
                  onClick={() => {
                    setContent(rewrittenContent);
                    setRewrittenContent(null);
                    setResult(null); // Go back to input with new content
                  }}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  采用此版本并重新分析
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Flowchart Modal */}
      <AnimatePresence>
        {flowchart && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFlowchart(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-black/5 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <GitBranch className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">游戏逻辑流程图</h3>
                    <p className="text-xs text-black/40 font-mono">基于文档核心逻辑自动生成的 Mermaid 流程图</p>
                  </div>
                </div>
                <button
                  onClick={() => setFlowchart(null)}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors text-black/40"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 flex items-center justify-center bg-black/[0.01]">
                <div className="w-full max-w-3xl">
                  <Mermaid chart={flowchart} />
                </div>
              </div>

              <div className="p-6 bg-black/[0.02] border-t border-black/5 flex justify-center gap-4">
                <button
                  onClick={() => copyToClipboard(flowchart)}
                  className="px-6 py-3 bg-white border border-black/10 text-black/60 rounded-2xl font-bold hover:bg-black/5 transition-all flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  复制 Mermaid 代码
                </button>
                <button
                  onClick={() => setFlowchart(null)}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  关闭预览
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-20 border-t border-black/5 py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs font-mono text-black/30 uppercase tracking-[0.2em]">
            由 Gemini 3 Flash & React 提供支持
          </p>
        </div>
      </footer>
    </div>
  );
}
