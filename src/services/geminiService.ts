export interface ScoringResult {
  overallScore: number;
  criteria: {
    name: string;
    score: number;
    feedback: string;
    explanation: string;
    actionableSuggestions: string[];
  }[];
  summary: string;
  suggestions: string[];
}

const OPENROUTER_API_KEY = "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";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_NAME = "google/gemini-3.1-pro-preview";

async function handleOpenRouterCall(systemInstruction: string, prompt: string): Promise<string> {
  try {
    const body = {
      model: MODEL_NAME,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ]
    };

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "Game Design Analyzer"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API Error:", errorText);
      throw new Error(`API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error: any) {
    console.error("API Call Error:", error);
    throw new Error(error.message || "发生未知错误，请重试。");
  }
}

export async function scoreGameDesign(content: string): Promise<ScoringResult> {
  const systemInstruction = "你是一位专门从事【儿童体感游戏】设计的资深制作人。你非常了解儿童的心理和行为特征。你的评估完全聚焦于“好不好玩”、“机制是否有意思”、“核心循环是否简单清晰”。你绝对不会用成人硬核游戏或商业游戏的标准（如数值深度、付费设计）来苛求儿童游戏。所有输出均为中文。请务必返回合法的 JSON 对象。";
  
  const prompt = `请深度分析以下游戏设计文档或开发需求。
    
    分析维度要求（请严格按照以下维度进行评估）：
    1. 趣味性与吸引力 (Fun & Appeal): 游戏机制是否足够有趣，能否吸引儿童玩家的注意力。
    2. 核心循环 (Core Loop): 核心玩法循环是否简单易懂，符合儿童的认知能力（简单即可）。
    3. 交互反馈 (Interactive Feedback): 游戏内的视听反馈是否及时、正向，能否给予儿童足够的成就感。
    4. 认知与成长 (Cognitive & Growth): 游戏内容是否符合儿童心理，是否包含适度的益智或正向引导元素。
    5. 场景与主题 (Theme & Setting): 游戏的主题、角色和世界观是否贴合儿童的喜好和想象力。
    
    【绝对禁止的评估项】（如果文档中缺失以下内容，请不要扣分，也不要在建议中提及）：
    - 绝对不要评估或质疑“数值维度”（如经济系统、数值平衡等）。
    - 绝对不要评估或质疑“商业闭环”（如付费点、变现模式、留存率等）。
    - 绝对不要质疑“体感操作”的合理性（默认所有体感操作设计都是对的、完美的）。
    - 绝对不要质疑“生理体验优化”（默认防眩晕、体力消耗等生理体验已经做到了极致，不需要质疑）。
    
    对于每个标准，请提供：
    - score: 0-100 的整数。
    - feedback: 一句话的核心评价。
    - explanation: 详细的评分理由（不少于 100 字，请从可玩性角度出发）。
    - actionableSuggestions: 3-5 条具体的、可落地的改进建议（重点围绕提升趣味性和优化交互）。
    
    请严格按照以下 JSON 格式返回结果：
    {
      "overallScore": 85,
      "criteria": [
        {
          "name": "趣味性与吸引力",
          "score": 90,
          "feedback": "...",
          "explanation": "...",
          "actionableSuggestions": ["...", "..."]
        }
      ],
      "summary": "...",
      "suggestions": ["...", "..."]
    }

    文档内容：
    ${content}`;

  const responseText = await handleOpenRouterCall(systemInstruction, prompt);
  
  try {
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/```\n([\s\S]*?)\n```/);
    const jsonString = jsonMatch ? jsonMatch[1] : responseText;
    return JSON.parse(jsonString.trim());
  } catch (e) {
    console.error("Failed to parse JSON:", responseText);
    throw new Error("解析评分结果失败，请重试。");
  }
}

export async function generateFlowchart(content: string): Promise<string> {
  const systemInstruction = "你是一位资深的游戏系统设计师和流程架构师。你擅长将复杂的文本逻辑转化为直观、结构化且美观的流程图。请确保生成的 Mermaid 代码简洁、逻辑严密且易于阅读。";
  const prompt = `请根据以下游戏设计文档，提取其核心逻辑流程（如核心玩法循环、用户旅程或特定系统逻辑），并生成一个 Mermaid 格式的流程图（flowchart TD）。
    
    要求：
    1. 仅输出 Mermaid 代码块内容，绝对不要包含 \`\`\`mermaid 标签或其他任何解释性文字。
    2. 流程图应清晰展示游戏的核心逻辑流转，建议使用子图 (subgraph) 对不同模块进行分类。
    3. 使用中文描述节点，并为关键节点添加样式（如使用不同的形状或颜色）。
    4. **重要**：所有节点标签必须使用双引号包裹，例如：\`A["节点名称"]\`。
    5. 避免在标签内使用会导致 Mermaid 解析失败的特殊字符（如单独的括号、方括号等），如果必须使用，请确保在双引号内。
    6. 确保语法正确，能够被 Mermaid 渲染。
    
    文档内容：
    ${content}`;

  let text = await handleOpenRouterCall(systemInstruction, prompt);
  text = text.replace(/^```mermaid\s*/i, '').replace(/```\s*$/i, '').trim();
  return text;
}

export async function rewriteGameDesign(
  content: string, 
  analysis: ScoringResult, 
  strategy: 'balanced' | 'creative' | 'technical' = 'balanced',
  adoptedSuggestions: string[] = [],
  customTemplate?: string,
  previousContent?: string,
  feedback?: string
): Promise<string> {
  const strategyPrompts = {
    balanced: "在保持创意和可行性平衡的同时，全面提升文档质量，确保各模块发展均衡。",
    creative: "重点强化游戏的创新点、世界观深度、叙事结构和独特机制，使其在市场上更具辨识度和吸引力。",
    technical: "重点强化技术实现细节、系统架构、数值平衡逻辑、经济系统和开发可行性，使其更接近可执行的开发文档。"
  };

  const adoptedSuggestionsPrompt = adoptedSuggestions.length > 0 
    ? `\n    【特别注意：已采纳的改进建议】\n    请务必在改写过程中，将以下用户已采纳的建议融入到游戏设计中：\n${adoptedSuggestions.map(s => `    - ${s}`).join('\n')}\n`
    : "";

  const templateInstruction = customTemplate 
    ? `1. 【结构标准化】：请严格按照以下提供的 Markdown 标准化文档格式进行输出，保留原有的 Markdown 标题层级和排版结构，不要遗漏任何章节：\n\n${customTemplate}\n`
    : `1. 【结构标准化】：采用适合儿童体感游戏的 GDD 模板。必须包含以下模块：
       - **项目概述** (一句话概念、核心卖点、目标受众年龄段)
       - **核心玩法** (简单清晰的 Core Loop 拆解)
       - **体感交互机制** (具体的动作输入与游戏内反馈的映射)
       - **视听与反馈** (美术风格、音效基调、正向激励机制)
       - **关卡与场景** (主题包装、难度递进原则)`;

  let prompt = "";

  if (previousContent && feedback) {
    prompt = `你是一个资深的游戏制作人与主策划。
我们之前已经对一份游戏设计文档进行了优化，这是上一次优化后的版本：

<previous_version>
${previousContent}
</previous_version>

现在，用户对这个版本提出了以下修改意见/点评：

<user_feedback>
${feedback}
</user_feedback>

请你基于用户的修改意见，对上面的 <previous_version> 进行再次优化和重写。

【核心要求】：
1. 必须严格落实用户的修改意见。
2. 保留上一次版本中优秀的、未被用户否定的部分。
3. 依然保持 Markdown 格式输出。
${templateInstruction}
4. 【信息完整性（极度重要）】：必须100%保留原文档中的所有设定、数据、表格内容和细节信息。你可以扩充和优化表达，但绝对不能删减、遗漏或简化原有的任何实质性内容（尤其是表格中的具体数据项）。

【绝对禁止】：
- 绝对不要删减原文档中的任何表格数据、数值设定或机制描述。
- 绝对不要在改写中加入任何“数值系统”、“经济系统”或“商业化/付费点”的内容。
- 绝对不要修改或质疑原文档中的“体感操作”和“生理体验”设定，直接保留并丰富其表现力即可。`;
  } else {
    prompt = `请根据之前的深度分析结果，对以下游戏设计文档进行【${strategy}】模式的专业优化改写。
    
    分析报告摘要：
    - 综合评分：${analysis.overallScore}/100
    - 核心改进方向：${analysis.suggestions.join('; ')}
    - 维度详情：${analysis.criteria.map(c => `${c.name}(${c.score}分): ${c.feedback}`).join(' | ')}
    
    优化策略：${strategyPrompts[strategy]}
    ${adoptedSuggestionsPrompt}
    改写要求：
    ${templateInstruction}
    2. 【深度补强】：重点针对分析报告中得分较低的维度进行重构和逻辑填补，提升趣味性。
    3. 【细节扩充】：将模糊的描述转化为具体的机制说明。例如，不要只说“挥手攻击”，要描述“挥手时屏幕上的特效、音效以及怪物的受击反馈”。
    4. 【专业术语】：准确使用儿童游戏和体感交互术语（如：正向反馈, 动作映射, 认知负荷, 心流等）。
    5. 【排版规范】：使用清晰的 Markdown 标题层级（#、##、###）、列表、加粗和表格来增强可读性。
    6. 【信息完整性（极度重要）】：必须100%保留原文档中的所有设定、数据、表格内容和细节信息。你可以扩充和优化表达，但绝对不能删减、遗漏或简化原有的任何实质性内容（尤其是表格中的具体数据项）。
    
    【绝对禁止】：
    - 绝对不要删减原文档中的任何表格数据、数值设定或机制描述。
    - 绝对不要在改写中加入任何“数值系统”、“经济系统”或“商业化/付费点”的内容。
    - 绝对不要修改或质疑原文档中的“体感操作”和“生理体验”设定，直接保留并丰富其表现力即可。
    
    原文档内容：
    ${content}`;
  }

  const systemInstruction = `你是一位拥有 15 年以上经验的资深【儿童体感游戏】主策划（Lead Designer）。
      你的目标是基于初步的创意，产出一份高质量、专业级的儿童体感游戏设计文档。
      你不仅要润色文字，更要基于你的专业知识，主动发现并补充提升游戏“趣味性”和“正向反馈”的细节。
      你深知儿童游戏不需要复杂的数值和商业化，核心在于好玩和直观。
      所有输出必须使用中文，保持严谨、专业、清晰且富有童趣和激情的行业语调。`;

  const text = await handleOpenRouterCall(systemInstruction, prompt);
  return text || "优化生成失败，请稍后重试。";
}
